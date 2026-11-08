// Vynco desktop: uma janela nativa (WebView2) para o painel local do Vynco.
// O Tauri inicia o Node que vem com o app (sidecar "vynco-node") rodando app/desktop/backend.js, espera a linha
// "Vynco: http://127.0.0.1:<porta>/" e leva a janela para lá. Fechar a janela encerra o backend.
// Em desenvolvimento (npm run desktop:dev), a janela abre direto no servidor do "npm start" (devUrl), sem sidecar.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use tauri::{Manager, RunEvent, Url, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

struct Backend(Mutex<Option<CommandChild>>);

fn main() {
    let app = tauri::Builder::default()
        // um Vynco só: abrir de novo traz a janela que já existe para a frente
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(janela) = app.get_webview_window("main") {
                let _ = janela.unminimize();
                let _ = janela.set_focus();
            }
        }))
        .plugin(tauri_plugin_shell::init())
        .manage(Backend(Mutex::new(None)))
        .setup(|app| {
            // começa na tela "Abrindo o Vynco..." (app/desktop/janela); em dev, já no servidor local
            let janela = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("Vynco")
                .inner_size(1240.0, 840.0)
                .min_inner_size(900.0, 640.0)
                .center()
                .build()?;
            if cfg!(debug_assertions) {
                return Ok(());
            }

            // recursos do app (motor, painel, prompts) e a pasta de trabalho do usuário (Documentos\Vynco)
            let recursos = app.path().resource_dir()?.join("vynco");
            let casa = app.path().document_dir()?.join("Vynco");
            let backend = recursos.join("app").join("desktop").join("backend.js");
            let (mut eventos, filho) = app
                .shell()
                .sidecar("vynco-node")?
                .args([backend.as_os_str()])
                .env("VYNCO_RECURSOS", recursos.as_os_str())
                .env("VYNCO_HOME", casa.as_os_str())
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
                            // o backend caiu antes de abrir: mostra as últimas linhas na tela de espera
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
