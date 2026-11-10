// Vynco desktop: uma janela nativa (WebView2) para o painel local do Vynco.
// O Tauri inicia o Node que vem com o app (sidecar "vynco-node") rodando app/desktop/backend.js, espera a linha
// "Vynco: http://127.0.0.1:<porta>/" e leva a janela para lá.
// Modo standby: fechar a janela só esconde o Vynco na bandeja (perto do relógio), e ele continua publicando no horário.
// Para sair de verdade: botão direito no ícone da bandeja → Sair. Aberto com --standby (início do Windows), começa escondido.
// Em desenvolvimento (npm run desktop:dev), a janela abre direto no servidor do "npm start" (devUrl), sem sidecar.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, RunEvent, Url, WebviewUrl, WebviewWindowBuilder, WindowEvent};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

struct Backend(Mutex<Option<CommandChild>>);

fn mostrar(app: &AppHandle) {
    if let Some(janela) = app.get_webview_window("main") {
        let _ = janela.show();
        let _ = janela.unminimize();
        let _ = janela.set_focus();
    }
}

fn main() {
    let app = tauri::Builder::default()
        // um Vynco só: abrir de novo traz a janela que já existe (mesmo escondida na bandeja)
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| mostrar(app)))
        .plugin(tauri_plugin_shell::init())
        .manage(Backend(Mutex::new(None)))
        // fechar a janela esconde: o backend continua de pé para publicar o que está agendado
        .on_window_event(|janela, evento| {
            if let WindowEvent::CloseRequested { api, .. } = evento {
                let _ = janela.hide();
                api.prevent_close();
            }
        })
        .setup(|app| {
            let escondido = std::env::args().any(|a| a == "--standby");

            // ícone na bandeja: clique abre; menu com Abrir e Sair
            let abrir = MenuItem::with_id(app, "abrir", "Abrir o Vynco", true, None::<&str>)?;
            let sair = MenuItem::with_id(app, "sair", "Sair (os posts agendados não saem com o Vynco fechado)", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&abrir, &sair])?;
            let mut bandeja = TrayIconBuilder::with_id("vynco")
                .tooltip("Vynco: publica no horário enquanto estiver aqui")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, ev| match ev.id().as_ref() {
                    "abrir" => mostrar(app),
                    "sair" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|bandeja, ev| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = ev {
                        mostrar(bandeja.app_handle());
                    }
                });
            if let Some(icone) = app.default_window_icon() {
                bandeja = bandeja.icon(icone.clone());
            }
            bandeja.build(app)?;

            // começa na tela "Abrindo o Vynco..." (app/desktop/janela); em dev, já no servidor local
            let janela = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("Vynco")
                .inner_size(1240.0, 840.0)
                .min_inner_size(900.0, 640.0)
                .center()
                // a barra da janela é desenhada pelo próprio Vynco (app/public/controles.js)
                .decorations(false)
                .shadow(true)
                .background_color(tauri::window::Color(12, 18, 32, 255))
                .visible(!escondido)
                .build()?;
            if cfg!(debug_assertions) {
                return Ok(());
            }

            // recursos do app (motor, painel, prompts) e a pasta de trabalho do usuário (Documentos\Vynco)
            let recursos = app.path().resource_dir()?.join("vynco");
            let casa = app.path().document_dir()?.join("Vynco");
            let backend = recursos.join("app").join("desktop").join("backend.js");
            let exe = std::env::current_exe().unwrap_or_default();
            let (mut eventos, filho) = app
                .shell()
                .sidecar("vynco-node")?
                .args([backend.as_os_str()])
                .env("VYNCO_RECURSOS", recursos.as_os_str())
                .env("VYNCO_HOME", casa.as_os_str())
                .env("VYNCO_EXE", exe.as_os_str())
                .spawn()?;
            app.state::<Backend>().0.lock().unwrap().replace(filho);

            tauri::async_runtime::spawn(async move {
                let mut aberto = false;
                let mut ultimas: Vec<String> = Vec::new();
                while let Some(evento) = eventos.recv().await {
                    match evento {
                        CommandEvent::Stdout(bytes) | CommandEvent::Stderr(bytes) => {
                            for linha in String::from_utf8_lossy(&bytes).lines() {
                                let linha = linha.trim();
                                if !aberto {
                                    if let Some(endereco) = linha.strip_prefix("Vynco: ") {
                                        if let Ok(url) = Url::parse(endereco.trim()) {
                                            aberto = true;
                                            let _ = janela.navigate(url);
                                            continue;
                                        }
                                    }
                                }
                                if !linha.is_empty() {
                                    ultimas.push(linha.to_string());
                                    if ultimas.len() > 8 {
                                        ultimas.remove(0);
                                    }
                                }
                            }
                        }
                        CommandEvent::Terminated(_) if !aberto => {
                            // o backend caiu antes de abrir: mostra a janela com as últimas linhas na tela de espera
                            let _ = janela.show();
                            let detalhe = serde_json::to_string(&ultimas.join("\n")).unwrap_or_else(|_| "\"\"".into());
                            let _ = janela.eval(&format!("window.falhou && window.falhou({detalhe})"));
                        }
                        _ => {}
                    }
                }
            });
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("não consegui iniciar o Vynco");

    app.run(|app, evento| {
        if let RunEvent::Exit = evento {
            if let Some(filho) = app.state::<Backend>().0.lock().unwrap().take() {
                let _ = filho.kill();
            }
        }
    });
}
