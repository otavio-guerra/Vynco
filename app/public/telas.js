'use strict'
// Vynco: Modo automático, tour, Criar, Agenda, conta, Ajustes, atualizações, cliques, teclado, avisos e a inicialização (fica por último).
// Carregado depois de app.js (index.html); usa as funções e o estado globais de lá.

// ---------------------------------------------------------------- modo automático (cartão no topo de Criar)
let AUTO_D = null, AUTO_OPC = { dailyUi: false, veto: 2 }
async function carregarAuto() {
  const box = $('[data-auto]'); if (!box) return
  try { AUTO_D = await api('/api/automatico') } catch (e) { box.innerHTML = ''; return }
  AUTO_OPC = { dailyUi: AUTO_D.dailyUi || (!AUTO_D.ativo && AUTO_D.design), veto: AUTO_D.veto ?? 2 }
  carregarLimites(); desenharAuto()
}
const DIA_NOME = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
function desenharAuto() {
  const box = $('[data-auto]'); if (!box || !AUTO_D) return
  const on = AUTO_D.ativo, p = on ? AUTO_D.aplicado : AUTO_D.plano
  const nivelTxt = { normal: 'Ritmo normal', economia: 'Economizando', reserva: 'Só a reserva' }[p?.nivel] || ''
  const linhas = (p?.slots || []).map(sl => `<tr><td>${DIA_NOME[sl.dia]}</td><td><b>${esc(sl.titulo)}</b><small>${esc(FMT_TXT[sl.formato] || sl.formato || '')}</small></td><td>cria ${esc(sl.criar)}</td><td>sai ${esc(sl.publicar)}</td><td><span class="auto-ia${sl.ia === 'reserva' ? ' res' : ''}">${sl.ia === 'reserva' ? 'reserva' : 'principal'}</span></td></tr>`).join('')
  box.innerHTML = `<header class="ed-box-h"><h3>Modo automático <span class="auto-st${on ? ' on' : ''}">${on ? 'ligado' : 'desligado'}</span></h3>${on ? '<span class="auto-a"><button class="link" type="button" data-auto-refazer>Refazer o plano agora</button><button class="btn sm" type="button" data-auto-off>Desligar</button></span>' : ''}</header>
    <p class="fine auto-txt">${on ? 'A sua IA cria nos dias abaixo, o Vynco confere e aprova sozinho, e o post entra na agenda.' : 'A sua IA cria, o Vynco confere cada post (arquivo, tamanho da legenda, trechos por preencher e o que você pediu para evitar) e aprova sozinho.'} Cada post entra na agenda com pelo menos ${AUTO_OPC.veto} ${AUTO_OPC.veto === 1 ? 'hora' : 'horas'} para você vetar. O que não passa na conferência fica em Revisar esperando você.</p>
    ${p?.erro ? `<p class="ini-alerta">${esc(p.erro)}</p>` : `<div class="auto-grid">
      <div class="auto-plano"><div class="auto-plano-h"><b>${nivelTxt}${p?.slots ? ` · ${p.slots.length} ${p.slots.length === 1 ? 'post' : 'posts'} por semana` : ''}</b><small>${esc(p?.motivo || '')}</small></div>
        <table class="auto-tab">${linhas}</table></div>
      <aside class="auto-folga"><b>Folga das suas IAs</b>${LIM?.principal ? `<div class="auto-ia-b"><small>${esc(LIM.principal.nome)} (principal)</small>${barrasUso(LIM.principal)}</div>` : ''}${LIM?.reserva ? `<div class="auto-ia-b"><small>${esc(LIM.reserva.nome)} (reserva)</small>${barrasUso(LIM.reserva)}</div>` : `<p class="uso-nota">Sem IA reserva. <button class="link" type="button" data-view="ajustes">Ligar o Antigravity (grátis)</button> para o plano não parar quando a principal chegar ao limite.</p>`}
        <p class="uso-nota">O plano é refeito todo dia com o uso de hoje. Com a semana pela metade, ele troca carrossel por texto e passa parte para a reserva.</p></aside>
    </div>`}
    ${on ? '' : `<div class="auto-opc">${AUTO_D.design ? `<label class="ed-switch"><input type="checkbox" data-auto-dui${AUTO_OPC.dailyUi ? ' checked' : ''}><span><b>Incluir o Daily UI</b><small>uma tela por dia útil, criada às 7h30 e publicada às 10h</small></span></label>` : ''}
      <label class="auto-veto"><span>Tempo para vetar</span><select class="sel" data-auto-veto>${[1, 2, 4, 12].map(h => `<option value="${h}"${+AUTO_OPC.veto === h ? ' selected' : ''}>${h} ${h === 1 ? 'hora' : 'horas'}</option>`).join('')}</select></label>
      <button class="btn accent" type="button" data-auto-on>Ligar o modo automático</button></div>`}`
}
$('[data-auto]')?.addEventListener('change', e => {
  if (e.target.matches('[data-auto-dui]')) { AUTO_OPC.dailyUi = e.target.checked; api('/api/automatico').then(d => { AUTO_D = { ...d, ativo: false }; desenharAuto() }).catch(() => {}) }
  if (e.target.matches('[data-auto-veto]')) { AUTO_OPC.veto = +e.target.value; desenharAuto() }
})
$('[data-auto]')?.addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b) return
  try {
    if (b.matches('[data-auto-on]')) {
      if (!(await confirmar('Ligar o modo automático?', `Os posts vão ao ar sem você ler antes. O Vynco confere cada um e só agenda com pelo menos ${AUTO_OPC.veto} ${AUTO_OPC.veto === 1 ? 'hora' : 'horas'} de folga, para você poder vetar. Dá para desligar quando quiser.`, 'Ligar'))) return
      await api('/api/automatico', { ativo: true, dailyUi: AUTO_OPC.dailyUi, veto: AUTO_OPC.veto }); Som.liga(); pill('Modo automático ligado', 'A sua IA cria e o Vynco aprova e agenda.', 'var(--green)')
    }
    if (b.matches('[data-auto-off]')) { await api('/api/automatico', { ativo: false }); Som.desliga(); pill('Modo automático desligado', 'O que já está na agenda continua lá.', 'var(--amber)') }
    if (b.matches('[data-auto-refazer]')) { await api('/api/automatico', { ativo: true, dailyUi: AUTO_D.dailyUi, veto: AUTO_D.veto }); Som.tique(); pill('Plano refeito', 'Com o uso de agora das suas IAs.', 'var(--green)') }
    if (b.matches('[data-auto-on], [data-auto-off], [data-auto-refazer]')) { await carregarAuto(); carregarRotinas() }
  } catch (err) { falha(err) }
})

// ---------------------------------------------------------------- tour guiado (depois da entrada)
// A tela escurece e só o item da vez fica aceso. Nos passos "clique", a pessoa clica no próprio item para seguir:
// um cursor animado mostra onde, e o Vynco abre a tela de verdade por trás. Nada fora do item responde ao clique.
const TOUR = [
  { titulo: 'Bem-vindo ao Vynco', texto: 'Em um minuto você conhece o app clicando nele mesmo. Dá para pular quando quiser.', icone: 'logo' },
  { sel: '#nav [data-view=inicio]', clique: 'inicio', titulo: 'Comece pelo Início', texto: 'Clique em Início. É aqui que você vê o que vai ao ar.' },
  { sel: '[data-ini-hero]:not([hidden]), [data-ini-resumo]', titulo: 'O que vai ao ar', texto: 'O próximo post fica em destaque, do jeito que aparece no LinkedIn, com quanto falta para sair. Embaixo, o resto da agenda, dia por dia.' },
  { sel: '#nav [data-view=perfil]', clique: 'perfil', titulo: 'Sua estratégia', texto: 'Clique em Estratégia.' },
  { sel: '[data-pf-resumo]', titulo: 'Você, em uma frase', texto: 'A sua IA lê isto antes de cada post. Toque em qualquer parte da frase para mudar, com os mesmos cartões da entrada.' },
  { sel: '#nav [data-view=rotinas]', clique: 'rotinas', titulo: 'Criar', texto: 'Clique em Criar.' },
  { sel: '[data-auto]', titulo: 'Modo automático', texto: 'Ligado, a sua IA cria nos dias do plano e o Vynco confere, aprova e agenda sozinho, com tempo para você vetar. O plano acompanha os seus créditos.' },
  { sel: '#nav [data-view=fila]', clique: 'fila', titulo: 'Revisar', texto: 'Clique em Revisar. O número mostra quantos posts esperam você.' },
  { sel: '.fila-grid', titulo: 'Olhe antes de ir ao ar', texto: 'Cada post ao lado da prévia do feed. A aprova, P publica e as setas trocam de post.' },
  { sel: '#nav [data-view=calendario]', clique: 'calendario', titulo: 'Agenda', texto: 'Clique em Agenda.' },
  { sel: '.cal-grid:not([hidden]), [data-ag-abas]', titulo: 'O mês inteiro', texto: 'O que sai e quando. Arraste um post para um dia para agendar. Em "No ar" fica o que já saiu, com o link.' },
  { sel: '#nav [data-view=conexoes]', clique: 'conexoes', titulo: 'Rede', texto: 'Clique em Conexões. A sua IA sugere pessoas e vagas para a sua área.' },
  { sel: '#conns', titulo: 'Sua conta e seus limites', texto: 'LinkedIn, IA e Magnific, com o uso da sessão. Clique nele quando quiser ver a semana e quando renova.' },
  { sel: '.lado-pe [data-view=ajustes]', clique: 'ajustes', titulo: 'Ajustes', texto: 'Clique em Ajustes.' },
  { sel: '[data-conn=reserva]', titulo: 'IA reserva', texto: 'Ligue o Antigravity (grátis) para o Vynco seguir criando quando a sua IA chegar ao limite. Em Preferências, "Abrir com o Windows" garante que nenhum horário se perde.' },
  { titulo: 'Tudo pronto!', texto: 'O Vynco só publica o que você aprovou, ou o que o modo automático conferiu. Este tour fica no menu da sua conta.', fim: true, icone: 'logo' },
]
let TOUR_I = -1, TOUR_ANDANDO = false
function tourIniciar() {
  if ($('#tour')) return
  menuConta(false)
  document.body.insertAdjacentHTML('beforeend', `<div id="tour" class="tour" role="dialog" aria-modal="true" aria-labelledby="tour-t">
    <div class="tour-bloq"></div><div class="tour-luz" hidden><i class="tour-pulso"></i><i class="tour-pulso p2"></i></div><button class="tour-alvo" type="button" hidden aria-label="Continuar"></button>
    <div class="tour-mao" hidden aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M11 4.5c1.2 0 2.2 1 2.2 2.2v8.1l1.2-.5c1.1-.4 2.3.1 2.8 1.1l.2.4 1.4-.4c1.1-.3 2.3.3 2.7 1.4l1.6-.2c1.3-.1 2.4.9 2.4 2.2v4.7c0 3.6-2.9 6.5-6.5 6.5h-3.4c-2.1 0-4-1-5.2-2.7l-4.2-6c-.7-1-.5-2.4.5-3.1.9-.6 2.1-.5 2.8.3l1.3 1.4V6.7c0-1.2 1-2.2 2.2-2.2z" fill="#fff" stroke="#0C1220" stroke-width="1.4" stroke-linejoin="round"/></svg></div>
    <div class="tour-pop glass"><div class="tour-barra"><i data-tour-barra></i></div><div class="tour-corpo" data-tour-corpo><span class="tour-n" data-tour-n></span><h3 id="tour-t" data-tour-t></h3><p data-tour-p></p><p class="tour-dica" data-tour-dica hidden></p></div>
      <div class="tour-a"><button class="link soft" type="button" data-tour="pular">Pular o tour</button><button class="btn sm" type="button" data-tour="voltar">Voltar</button><button class="btn sm accent" type="button" data-tour="prox">Próximo</button></div></div></div>`)
  $('#tour').addEventListener('click', e => {
    if (e.target.closest('.tour-alvo')) return tourClicouAlvo()
    const b = e.target.closest('[data-tour]'); if (!b) return
    const a = b.dataset.tour; a === 'pular' ? tourFim() : a === 'voltar' ? tourIr(TOUR_I - 1) : TOUR[TOUR_I].fim ? tourFim(true) : TOUR[TOUR_I].clique ? tourClicouAlvo() : tourIr(TOUR_I + 1)
  })
  addEventListener('resize', tourPosicionar); addEventListener('keydown', tourTecla, true)
  tourIr(0)
}
function tourTecla(e) {
  if (!$('#tour')) return
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); return tourFim() }
  if (e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); return TOUR[TOUR_I].fim ? tourFim(true) : TOUR[TOUR_I].clique ? tourClicouAlvo() : tourIr(TOUR_I + 1) }
  if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); return tourIr(TOUR_I - 1) }
  if (e.key !== 'Tab') e.stopPropagation()
}
// clicar no item aceso faz o que ele faria de verdade (abre a tela) e segue o tour
function tourClicouAlvo() {
  const p = TOUR[TOUR_I]; if (!p || TOUR_ANDANDO) return
  Som.liga(); $('.tour-luz')?.classList.add('apertou')
  if (p.clique) { voltarPara = null; cena(p.clique, { som: false }) }
  setTimeout(() => tourIr(TOUR_I + 1), reduced ? 0 : 380)
}
async function tourIr(i) {
  if (i < 0 || i >= TOUR.length || TOUR_ANDANDO) return
  TOUR_ANDANDO = true
  const ant = TOUR_I; TOUR_I = i; const p = TOUR[i], t = $('#tour')
  // volta para um passo que estava em outra tela: reabre a tela certa
  // a tela por trás é a do último passo de clique antes deste (vale para avançar, voltar ou pular)
  { const c = [...TOUR.slice(0, i)].reverse().find(x => x.clique), tela = c ? c.clique : 'inicio', real = tela === 'conexoes' || tela === 'vagas' ? 'rede' : tela; if (atual?.dataset.scene !== real || (real === 'rede' && RD_FOCO !== tela)) { voltarPara = null; cena(tela, { som: false }) } }
  await espera(reduced ? 0 : 280)
  const alvo = p.sel && [...$$(p.sel)].find(el => el.getClientRects().length)
  if (alvo) alvo.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' })
  const corpo = $('[data-tour-corpo]'); corpo.classList.remove('troca'); void corpo.offsetWidth; corpo.classList.add('troca')
  // cabeçalho do balão: a marca do Vynco nos passos de abertura e fim; nos outros, o ícone da própria seção
  const ico = p.icone ? ($('#wordmark svg')?.outerHTML || '') : (alvo?.querySelector('svg') || $(`#nav [data-view=${p.clique || ''}] svg`))?.outerHTML || ''
  $('[data-tour-n]').classList.toggle('ic', !!p.icone)
  $('[data-tour-n]').innerHTML = `${ico ? `<span class="tour-ico">${ico}</span>` : ''}<span>${p.icone ? (p.fim ? 'Tour concluído' : 'Tour do Vynco') : `Passo ${i} de ${TOUR.length - 2}`}</span>`
  $('[data-tour-t]').textContent = p.titulo
  $('[data-tour-p]').textContent = p.texto
  const dica = $('[data-tour-dica]'); dica.hidden = !(p.clique && alvo); dica.textContent = 'Clique no item aceso para continuar (ou aperte Enter)'
  $('[data-tour-barra]').style.width = Math.round(i / (TOUR.length - 1) * 100) + '%'
  $('[data-tour=voltar]').hidden = i === 0
  $('[data-tour=prox]').textContent = p.fim ? 'Começar a usar' : i === 0 ? 'Começar o tour' : 'Próximo'
  $('[data-tour=prox]').hidden = !!(p.clique && alvo)   // nos passos de clique, quem avança é o próprio item (ou Enter)
  $('[data-tour=prox]').classList.toggle('accent', !(p.clique && alvo))
  $('[data-tour=pular]').hidden = !!p.fim
  t.classList.toggle('clique', !!(p.clique && alvo)); t.dataset.alvo = alvo ? '1' : ''
  $('.tour-luz')?.classList.remove('apertou')
  Som.tique()
  TOUR_ANDANDO = false
  setTimeout(() => { tourPosicionar(); (p.clique && alvo ? null : $('[data-tour=prox]'))?.focus({ preventScroll: true }) }, reduced ? 0 : 320)
  if (p.fim && window.fx) setTimeout(() => fx.confete(innerWidth / 2, innerHeight / 2 - 40, 140), 250)
}
function tourPosicionar() {
  const t = $('#tour'); if (!t) return
  const p = TOUR[TOUR_I], alvo = p.sel && [...$$(p.sel)].find(el => el.getClientRects().length), luz = $('.tour-luz', t), pop = $('.tour-pop', t), hit = $('.tour-alvo', t), mao = $('.tour-mao', t)
  const r = alvo ? alvo.getBoundingClientRect() : null
  t.classList.toggle('centro', !r)
  luz.hidden = !r; hit.hidden = !(r && p.clique); mao.hidden = !(r && p.clique)
  if (!r) { pop.style.left = pop.style.top = ''; return }
  const pad = 6, box = { left: r.left - pad, top: r.top - pad, width: r.width + pad * 2, height: r.height + pad * 2 }
  for (const el of [luz, hit]) Object.assign(el.style, { left: box.left + 'px', top: box.top + 'px', width: box.width + 'px', height: box.height + 'px' })
  const pw = pop.offsetWidth, ph = pop.offsetHeight, m = 18, W = innerWidth, H = innerHeight
  let x, y, lado
  if (r.right + m + pw < W) { x = r.right + m + pad; y = r.top + r.height / 2 - ph / 2; lado = 'dir' }
  else if (r.bottom + m + ph < H) { x = r.left + r.width / 2 - pw / 2; y = r.bottom + m + pad; lado = 'baixo' }
  else { x = r.left + r.width / 2 - pw / 2; y = r.top - ph - m - pad; lado = 'cima' }
  pop.style.left = Math.max(12, Math.min(W - pw - 12, x)) + 'px'
  pop.style.top = Math.max(12, Math.min(H - ph - 12, y)) + 'px'
  pop.dataset.lado = lado
  // a mãozinha sai do balão e "toca" no centro do item
  if (p.clique) { mao.style.setProperty('--x', (r.left + r.width / 2) + 'px'); mao.style.setProperty('--y', (r.top + r.height / 2) + 'px'); mao.classList.remove('vai'); void mao.offsetWidth; mao.classList.add('vai') }
}
function tourFim(concluiu) {
  $('#tour')?.remove(); removeEventListener('resize', tourPosicionar); removeEventListener('keydown', tourTecla, true)
  store.set('tour', '1'); Som.liga(); TOUR_ANDANDO = false
  if (concluiu) pill('Você já conhece o Vynco', 'O tour fica no menu da sua conta, se quiser ver de novo.', 'var(--green)')
  if (atual?.dataset.scene !== 'inicio') { voltarPara = null; cena('inicio') }
}
// começa sozinho na primeira vez que a pessoa chega ao app depois da entrada
function tourSeNovo() { if (store.get('tour') !== '1' && !DEMO_CAPTURA()) setTimeout(() => { if (!$('#tour') && !ONB.includes(atual?.dataset.scene)) tourIniciar() }, 900) }
const DEMO_CAPTURA = () => document.documentElement.classList.contains('static')

// ---------------------------------------------------------------- criar: modelos de post (rotinas) para qualquer área
let ROT = null, ROT_F = 'todos', ROT_AB = null, ROT_FORM = null, PERF_CR = null
const DIAS_C = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'], DIAS_N = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const FMT_MOD = { carrossel: 'Carrossel', texto: 'Texto', imagem: 'Imagem' }
const agendaTxt = a => {
  if (!a || !a.ativo || !(a.dias || []).length) return ''
  const d = [...a.dias].sort(), uteis = d.join() === '1,2,3,4,5'
  return `Repete ${d.length === 7 ? 'todo dia' : uteis ? 'de segunda a sexta' : d.map(x => DIAS_N[x]).join(', ')} às ${a.hora || '08:00'}`
}
async function carregarRotinas() {
  try { [ROT, PERF_CR] = await Promise.all([api('/api/runs'), api('/api/perfil').then(r => r.perfil).catch(() => PERF_CR)]) } catch (e) { return falha(e) }
  if (!ST) await status()
  FLUXO_RUNS = ROT.runs.filter(r => r.status === 'rodando').length
  if (!FILA.length) { try { FILA = await api('/api/queue') } catch { } }
  desenharRotinas(); desenharFluxo()
  if (ROT.runs.some(r => r.status === 'rodando')) setTimeout(() => atual?.dataset.scene === 'rotinas' && carregarRotinas(), 4000)
}
function desenharRotinas() {
  const d = ROT, temDesign = d.rotinas.some(r => r.design)
  $('[data-rot-sub]').textContent = !d.agente ? 'Conecte uma IA em Ajustes (no pé do menu) para criar peças.' : `A sua IA (${d.agente}) cria a peça a partir do seu perfil${d.perfil?.area ? ` (${d.perfil.area})` : ''} e para antes de publicar. Nada vai ao ar sem você aprovar.`
  const f = $('[data-rot-filtro]')
  if (temDesign && !$('[data-v=design]', f)) f.insertAdjacentHTML('beforeend', '<button data-v="design">Design</button>')
  $$('button', f).forEach(b => b.classList.toggle('on', b.dataset.v === ROT_F))
  $('[data-rot-avisos]').innerHTML = ''
  // o que o registro da IA quer dizer, em português, com o próximo passo
  const explicar = t => {
    t = String(t || '')
    if (/no longer supported for Gemini Code Assist|IneligibleTier/i.test(t)) return { t: 'O Gemini grátis foi desligado', d: 'O Google encerrou o plano grátis do Gemini CLI em junho de 2026. Troque a IA reserva para o Antigravity, o substituto grátis.', a: 'ajustes' }
    if (/trusted (directory|folder)|workspace trust/i.test(t)) return { t: 'A IA recusou a pasta do Vynco', d: 'Ela pede para confiar na pasta antes de trabalhar. Sincronize de novo em Ajustes para liberar.', a: 'ajustes' }
    if (/(hit your|usage|weekly|session|daily).{0,24}limit|rate.?limit|\b429\b|quota|exceeded|resource.?exhausted/i.test(t)) return { t: 'A sua IA chegou ao limite de uso', d: 'Ela volta quando a cota renovar. Com uma IA reserva ligada, o Vynco não para.', a: 'ajustes' }
    if (/authenticat|not logged|log ?in required|sign ?in|credential|\b401\b|unauthori[sz]ed/i.test(t)) return { t: 'A sua IA pediu login de novo', d: 'O acesso dela venceu. Entre de novo na conta em Ajustes.', a: 'ajustes' }
    if (/ENOENT|not recognized|não é reconhecido|command not found|não encontrado/i.test(t)) return { t: 'Faltou um programa', d: 'A IA não achou uma ferramenta de que precisa. Sincronize de novo em Ajustes.', a: 'ajustes' }
    if (/timed? ?out|tempo esgotado|ETIMEDOUT|deadline/i.test(t)) return { t: 'Demorou demais', d: 'A criação passou do tempo. Tente de novo; costuma ser instabilidade da IA.', a: 'tentar' }
    return { t: 'A IA parou antes de terminar', d: 'Tente de novo. Se acontecer outra vez, o registro técnico abaixo mostra o motivo.', a: 'tentar' }
  }
  const card = r => {
    const u = d.runs.find(x => x.id === r.id), rodando = u && u.status === 'rodando', ag = agendaTxt(r.agenda)
    const est = !u ? '' : rodando ? `<span class="rot-st run"><span class="spin"></span>Criando… começou às ${new Date(u.inicio).toLocaleTimeString('pt-BR', { timeStyle: 'short' })}</span>`
      : u.status === 'concluída' ? `<span class="rot-st ok">Pronto às ${new Date(u.fim || u.inicio).toLocaleTimeString('pt-BR', { timeStyle: 'short' })} · <button class="link" data-view="fila">revisar</button></span>`
      : u.status === 'passou para a reserva' ? `<span class="rot-st run"><span class="spin"></span>A principal não conseguiu; a IA reserva está criando</span>`
      : (() => { const x = explicar(u.tail); return `<div class="rot-erro" role="status"><b>${esc(x.t)}</b><span>${esc(x.d)}${u.agente ? ` <small>(${esc(u.agente)}${u.reserva ? ', IA reserva' : ''})</small>` : ''}</span>${x.a === 'ajustes' ? '<button class="link" type="button" data-view="ajustes">Abrir Ajustes</button>' : ''}</div>` })()
    const form = ROT_AB === r.id ? `<div class="rot-form">
        <span class="fine">Em quais dias a IA cria este post?</span>
        <div class="dias" role="group" aria-label="Dias da semana">${DIAS_C.map((c, k) => `<button type="button" data-rot-dia="${k}" class="${ROT_FORM.dias.includes(k) ? 'on' : ''}" aria-pressed="${ROT_FORM.dias.includes(k)}" title="${DIAS_N[k]}">${c}</button>`).join('')}</div>
        <label class="hora"><span>às</span><input type="time" data-rot-hora value="${esc(ROT_FORM.hora)}"></label>
        <div class="row"><button class="btn sm accent" data-rot-salvar="${r.id}">Salvar</button>${r.agenda?.ativo ? `<button class="btn sm" data-rot-parar="${r.id}">Parar de repetir</button>` : ''}<button class="link soft" data-rot-fechar>Cancelar</button></div>
        <p class="fine">Roda enquanto o Vynco estiver aberto (se estiver fechado, roda quando você abrir). A peça vai para Revisar esperando você.</p></div>` : ''
    return `<article class="glass rot-card${rodando ? ' rodando' : ''}">
      <div class="rot-art">${wire(r.formato === 'imagem' ? 'gif' : r.formato)}</div>
      <div class="rot-c">
        <header><h3>${esc(r.titulo)}</h3><div class="vg-tags"><span class="vg-tag">${FMT_MOD[r.formato] || r.formato}</span>${r.web ? '<span class="vg-tag">pesquisa na web</span>' : ''}${r.design ? '<span class="vg-tag">design</span>' : ''}</div></header>
        <p>${esc(r.desc)}</p>
        <small class="rot-agenda${ag ? ' on' : ''}">${ag || `Sugestão: ${esc(r.freqTxt || '')}`}</small>
        ${est}
        <div class="row"><button class="btn sm${rodando ? '' : ' accent'}" data-run="${r.id}" ${rodando || !d.agente ? 'disabled' : ''}>${rodando ? 'Criando…' : 'Criar agora'}</button><button class="btn sm" data-rot-rep="${r.id}" title="${ag ? 'Mudar a repetição' : 'Repetir este modelo'}" aria-expanded="${ROT_AB === r.id}">${ag ? 'Mudar' : 'Repetir'}</button></div>
        ${form}
        ${u ? `<details class="more"><summary>${u.status === 'falhou' ? 'Registro técnico' : 'O que a IA fez'}</summary><pre class="log">${esc(u.tail || '…')}</pre></details>` : ''}
      </div></article>`
  }
  const rec = recomendados(PERF_CR || {}, d.rotinas)
  $('[data-rot-rec]').innerHTML = rec.ids.length ? `<div class="cr-head"><h2>Recomendados para você</h2><p class="fine">${esc(rec.motivo)}</p></div><div class="rot-grid rec">${rec.ids.map(id => card(d.rotinas.find(r => r.id === id))).join('')}</div>` : ''
  const lista = d.rotinas.filter(r => !rec.ids.includes(r.id)).filter(r => ROT_F === 'todos' || (ROT_F === 'design' ? r.design : r.formato === ROT_F && !r.design))
  $('[data-rotinas]').innerHTML = lista.map(card).join('') || `<div class="es-vazio"><p>Nenhum modelo neste filtro.</p></div>`
}
// três modelos que combinam com o que a pessoa quer do LinkedIn (o mesmo critério da entrada)
const REC_OBJ = { 'Conseguir uma vaga': ['licao', 'bastidores', 'dicas'], 'Conseguir clientes': ['mito-verdade', 'dicas', 'recomendacao'], 'Ser referência na área': ['dicas', 'opiniao', 'passo-a-passo'], 'Fazer networking': ['pergunta', 'opiniao', 'bastidores'], 'Divulgar meu negócio': ['passo-a-passo', 'bastidores', 'mito-verdade'], 'Mudar de área': ['licao', 'recomendacao', 'pergunta'], 'Aprender em público': ['licao', 'recomendacao', 'dicas'] }
function recomendados(p, modelos) {
  const existe = id => modelos.some(m => m.id === id), objs = Object.keys(REC_OBJ).filter(o => String(p.objetivo || '').toLowerCase().includes(o.toLowerCase()))
  const ids = []
  if (existe('daily-ui') && /design|ux|ui\b/i.test(p.area || '')) ids.push('daily-ui')
  for (const o of objs) for (const id of REC_OBJ[o]) if (existe(id) && !ids.includes(id)) ids.push(id)
  for (const id of ['dicas', 'licao', 'pergunta']) if (existe(id) && !ids.includes(id)) ids.push(id)
  return { ids: ids.slice(0, 3), motivo: objs.length ? `Para quem quer ${listaE(objs.map(o => o.toLowerCase()))}. Cada um usa os seus pilares e o seu tom.` : 'Bons para começar. Conte o seu objetivo em Estratégia para recomendações mais certeiras.' }
}
async function rodar(id) {
  if (!ST) await status()
  if (!ST?.agente?.conectado) return falha(new Error('Conecte uma IA primeiro em Ajustes.'))
  try { await api('/api/run', { id }); Som.liga(); pill('Criando o seu post', 'Ele aparece em Revisar quando ficar pronto (de 2 a 10 minutos).', 'var(--violet)'); if (atual?.dataset.scene === 'rotinas') carregarRotinas() } catch (e) { falha(e) }
}
$('[data-rot-filtro]').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; ROT_F = b.dataset.v; Som.tique(); desenharRotinas() })
$('[data-rotinas]').addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b) return
  if (b.dataset.rotRep) { const r = ROT.rotinas.find(x => x.id === b.dataset.rotRep); ROT_AB = ROT_AB === r.id ? null : r.id; ROT_FORM = { dias: r.agenda?.ativo ? [...r.agenda.dias] : r.freq === 'diario' ? [1, 2, 3, 4, 5] : [2], hora: r.agenda?.hora || '08:00' }; Som.tique(); return desenharRotinas() }
  if (b.dataset.rotDia != null) { const k = +b.dataset.rotDia; ROT_FORM.dias = ROT_FORM.dias.includes(k) ? ROT_FORM.dias.filter(x => x !== k) : [...ROT_FORM.dias, k]; Som.tique(); return desenharRotinas() }
  if (b.matches('[data-rot-fechar]')) { ROT_AB = null; return desenharRotinas() }
  const salvar = b.dataset.rotSalvar, parar = b.dataset.rotParar
  if (salvar || parar) {
    ROT_FORM.hora = $('[data-rot-hora]')?.value || ROT_FORM.hora
    if (salvar && !ROT_FORM.dias.length) return pill('Escolha pelo menos um dia', '', 'var(--amber)')
    try {
      await api('/api/rotinas/agendar', { id: salvar || parar, ativo: !!salvar, dias: ROT_FORM.dias, hora: ROT_FORM.hora })
      ROT_AB = null; salvar ? Som.liga() : Som.desliga()
      pill(salvar ? 'Repetição salva' : 'Não repete mais', salvar ? agendaTxt({ ativo: true, ...ROT_FORM }) : '', salvar ? 'var(--green)' : 'var(--amber)')
      carregarRotinas()
    } catch (err) { falha(err) }
  }
})

// ---------------------------------------------------------------- calendário: o que foi ao ar, o que está agendado e o que as rotinas vão criar
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const hhmm = d => d.toTimeString().slice(0, 5)
const hoje0 = () => ymd(new Date())
let CAL = { ano: new Date().getFullYear(), mes: new Date().getMonth(), dia: hoje0() }, CAL_ROT = [], AG_ABA = 'mes'
async function carregarCalendario() {
  try { const [f, r] = await Promise.all([api('/api/queue'), api('/api/runs'), ST ? null : status()]); FILA = f; CAL_ROT = r.rotinas.filter(x => x.agenda?.ativo) } catch (e) { return falha(e) }
  desenharCalendario(); contarFila(); desenharAgAba()
}
function desenharAgAba() {
  const noar = AG_ABA === 'noar', pub = FILA.filter(i => i.published).sort((a, b) => String(b.published.quando || '').localeCompare(String(a.published.quando || '')))
  $$('[data-ag]').forEach(b => b.toggleAttribute('aria-current', b.dataset.ag === AG_ABA))
  const n = $('[data-ag-n]'); n.hidden = !pub.length; n.textContent = pub.length
  for (const sel of ['.cal-legenda', '.cal-grid', '.cal-nav']) { const el = $('[data-scene=calendario] ' + sel); if (el) el.hidden = noar }
  const box = $('[data-ag-noar]'); box.hidden = !noar
  if (noar) box.innerHTML = pub.length ? `<p class="fine noar-nota">O LinkedIn não deixa apps lerem curtidas, comentários ou alcance. Aqui fica o que saiu, quando e o link para ver no LinkedIn.</p>` + pub.map(i => `<article class="noar-it glass"><div class="noar-capa">${capa(i)}</div><span><b>${esc(i.title)}</b><small>${FMT_TXT[i.formato] || ''} · publicado ${i.published.quando ? new Date(i.published.quando).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' }) : ''}</small></span>${i.published.link ? `<a class="btn sm" href="${esc(urlOk(i.published.link))}" target="_blank" rel="noopener">Ver no LinkedIn ↗</a>` : ''}</article>`).join('')
    : `<div class="empty"><h3>Nada publicado ainda.</h3><p>Quando um post for ao ar, ele aparece aqui com a data e o link.</p><div class="cta small"><button class="btn sm accent" data-view="fila">Ir para Revisar</button></div></div>`
  if (noar) $('[data-cal-titulo]').textContent = 'No ar.'
  $('[data-cal-sub]').textContent = noar ? (pub.length ? `${pub.length} ${pub.length === 1 ? 'post publicado' : 'posts publicados'} pelo Vynco.` : 'O que foi ao ar aparece aqui.') : $('[data-cal-sub]').textContent
}
$('[data-ag-abas]')?.addEventListener('click', e => { const b = e.target.closest('[data-ag]'); if (!b) return; AG_ABA = b.dataset.ag; Som.tique(); if (AG_ABA === 'mes') desenharCalendario(); desenharAgAba() })
function eventos(ds) {
  const ev = []
  for (const i of FILA) {
    if (i.published?.quando && ymd(new Date(i.published.quando)) === ds) ev.push({ t: 'pub', i, hora: hhmm(new Date(i.published.quando)) })
    else if (i.agendado && ymd(new Date(i.agendado)) === ds) ev.push({ t: 'ag', i, hora: hhmm(new Date(i.agendado)) })
  }
  const dow = new Date(ds + 'T12:00').getDay()
  if (ds >= hoje0()) for (const r of CAL_ROT) if (r.agenda.dias.includes(dow) && !(ds === hoje0() && r.agenda.ultima === ds)) ev.push({ t: 'rot', r, hora: r.agenda.hora || '08:00' })
  return ev.sort((a, b) => a.hora.localeCompare(b.hora))
}
const chaveIt = i => `${i.kind}:${i.id}`
const semData = () => FILA.filter(i => !i.published && !i.agendado && !i.rascunho).sort((a, b) => (b.approved ? 1 : 0) - (a.approved ? 1 : 0))
function desenharCalendario() {
  const { ano, mes } = CAL, prim = new Date(ano, mes, 1), ini = new Date(ano, mes, 1 - prim.getDay()), hoje = hoje0()
  $('[data-cal-titulo]').innerHTML = `${MESES[mes][0].toUpperCase() + MESES[mes].slice(1)} <span class="soft">${ano}</span>`
  const doMes = FILA.filter(i => { const q = i.published?.quando || i.agendado; return q && new Date(q).getMonth() === mes && new Date(q).getFullYear() === ano })
  const nAg = doMes.filter(i => !i.published).length, nPub = doMes.filter(i => i.published).length
  $('[data-cal-sub]').textContent = nAg || nPub ? `${nPub} ${nPub === 1 ? 'post no ar' : 'posts no ar'} e ${nAg} ${nAg === 1 ? 'agendado' : 'agendados'} neste mês.` : 'Nada agendado neste mês ainda. Arraste um post da lista "Sem data" para um dia.'
  let h = DIAS_N.map(d => `<div class="cal-dow" role="columnheader">${d}</div>`).join('')
  for (let k = 0; k < 42; k++) {
    const d = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() + k), ds = ymd(d), ev = eventos(ds), fora = d.getMonth() !== mes
    if (k === 35 && fora) break   // não desenha a 6ª semana quando ela é toda do mês seguinte
    h += `<div class="cal-d${[0, 6].includes(d.getDay()) ? ' fds' : ''}${ev.length ? ' tem' : ''}${ev.length === 1 ? ' um' : ''}${fora ? ' fora' : ''}${ds === hoje ? ' hoje' : ''}${ds === CAL.dia ? ' sel' : ''}${ds < hoje ? ' passado' : ''}" role="gridcell" tabindex="${ds === CAL.dia ? 0 : -1}" data-dia="${ds}" aria-label="${d.getDate()} de ${MESES[d.getMonth()]}: ${ev.length ? ev.length + (ev.length === 1 ? ' item' : ' itens') : 'vazio'}">
      <span class="cal-n">${d.getDate()}</span>
      ${ev.slice(0, 3).map(e => `<span class="cal-ev ${e.t}"${e.t === 'ag' ? ` draggable="true" data-arrasta="${esc(chaveIt(e.i))}"` : ''} ${e.i ? `data-ev-k="${esc(chaveIt(e.i))}"` : `data-ev-rot="${esc(e.r.id)}"`} data-ev-hora="${e.hora}" data-ev-dia="${ds}"><i>${e.hora}</i>${esc(e.i ? e.i.title : e.r.titulo)}</span>`).join('')}
      ${ev.length > 3 ? `<span class="cal-mais">+${ev.length - 3}</span>` : ''}</div>`
  }
  $('[data-cal-mes]').innerHTML = h
  desenharDia(); desenharCalAvisos()
  const sem = semData()
  $('[data-cal-nsem]').textContent = sem.length || ''
  $('[data-cal-sem]').innerHTML = sem.length ? sem.map(i => `<div class="cal-it" draggable="true" data-arrasta="${esc(chaveIt(i))}"><span class="state ${estado(i)}"></span><span><b>${esc(i.title)}</b><small>${FMT_TXT[i.formato] || ''} · ${estadoTxt(i)}</small></span></div>`).join('') : '<p class="fine">Nada esperando data. Peça um post novo em Criar.</p>'
}
// pop-up do evento no calendário: o que é, quando, estado e uma prévia em miniatura
let CAL_POP = null, calPopT = null
function calPopFechar() { clearTimeout(calPopT); CAL_POP?.remove(); CAL_POP = null }
function calPop(el) {
  calPopFechar()
  const k = el.dataset.evK, i = k && itemDe(k), rot = !i && CAL_ROT.find(r => r.id === el.dataset.evRot), dia = new Date(el.dataset.evDia + 'T12:00')
  if (!i && !rot) return
  const quando = `${dia.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })} · ${el.dataset.evHora}`
  const tipo = i ? (i.published ? ['pub', 'No ar'] : i.approved ? ['ag', 'Agendado · sai sozinho'] : ['falta', 'Agendado · falta aprovar']) : ['rot', 'A sua IA vai criar']
  const leg = i ? (i.caption || '').split('\n').filter(x => x.trim()) : []
  const p = document.createElement('div'); p.className = 'cal-pop'; p.setAttribute('role', 'tooltip')
  p.innerHTML = i ? `<div class="cal-pop-capa">${capa(i)}</div><div class="cal-pop-c"><span class="cal-pop-t ${tipo[0]}">${tipo[1]}</span><b>${esc(leg[0] || i.title)}</b><small>${esc(quando)} · ${esc(FMT_TXT[i.formato] || i.formato || '')}</small>${leg[1] ? `<p>${esc(leg.slice(1).join(' ').slice(0, 120))}${leg.slice(1).join(' ').length > 120 ? '…' : ''}</p>` : ''}<span class="cal-pop-a">Clique para abrir o dia</span></div>`
    : `<div class="cal-pop-capa rot">${wire(rot.formato === 'imagem' ? 'gif' : rot.formato || 'texto')}</div><div class="cal-pop-c"><span class="cal-pop-t rot">${tipo[1]}</span><b>${esc(rot.titulo)}</b><small>${esc(quando)}</small><p>Ela cria o post nesse horário e manda para Revisar${rot.agenda?.auto ? '; no modo automático, o Vynco confere e agenda' : ''}.</p></div>`
  document.body.appendChild(p); CAL_POP = p
  const r = el.getBoundingClientRect(), pr = p.getBoundingClientRect()
  let x = r.left + r.width / 2 - pr.width / 2, y = r.top - pr.height - 10
  if (y < 60) y = r.bottom + 10
  p.style.left = Math.max(12, Math.min(innerWidth - pr.width - 12, x)) + 'px'; p.style.top = y + 'px'
}
$('[data-cal-mes]')?.addEventListener('mouseover', e => { const el = e.target.closest('.cal-ev'); if (!el || CAL_POP?.dataset.de === el.dataset.evK + el.dataset.evHora) return; clearTimeout(calPopT); calPopT = setTimeout(() => { calPop(el); if (CAL_POP) CAL_POP.dataset.de = el.dataset.evK + el.dataset.evHora }, 260) })
$('[data-cal-mes]')?.addEventListener('mouseout', e => { if (!e.relatedTarget || !e.relatedTarget.closest || !e.relatedTarget.closest('.cal-ev')) calPopFechar() })
addEventListener('scroll', calPopFechar, true); addEventListener('dragstart', calPopFechar)
function desenharDia() {
  const ds = CAL.dia, d = new Date(ds + 'T12:00'), ev = eventos(ds), passado = ds < hoje0(), sem = semData()
  $('[data-cal-dia]').innerHTML = `<header class="ed-box-h"><h3>${d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>${ds === hoje0() ? '<span class="tag">hoje</span>' : ''}</header>
    <div class="cal-lista">${ev.length ? ev.map(e => e.t === 'rot'
      ? `<div class="cal-li rot"><i>${e.hora}</i><span><b>${esc(e.r.titulo)}</b><small>a sua IA cria e manda para Revisar</small></span><button class="link" data-view="rotinas">Ajustar</button></div>`
      : `<div class="cal-li ${e.t}"><i>${e.hora}</i><span><b>${esc(e.i.title)}</b><small>${e.t === 'pub' ? 'no ar' : e.i.approved ? 'agendado · sai sozinho' : 'agendado · falta aprovar'}</small></span>
          ${e.t === 'pub' ? `<a class="link" href="${esc(urlOk(e.i.published.link))}" target="_blank" rel="noopener">Ver ↗</a>` : `<span class="cal-li-a"><input type="time" value="${e.hora}" data-cal-hora="${esc(chaveIt(e.i))}" aria-label="Horário"><button class="link" data-cal-fila="${esc(chaveIt(e.i))}">Abrir</button><button class="link soft" data-cal-tirar="${esc(chaveIt(e.i))}">Tirar</button></span>`}</div>`).join('')
      : `<p class="fine">${passado ? 'Nada neste dia.' : 'Dia livre.'}</p>`}</div>
    ${!passado && sem.length ? `<div class="cal-add"><select data-cal-add aria-label="Post para agendar">${sem.map(i => `<option value="${esc(chaveIt(i))}">${esc(i.title)}${i.approved ? '' : ' (falta aprovar)'}</option>`).join('')}</select><input type="time" data-cal-add-hora value="${store.get('hora', '09:00')}" aria-label="Horário"><button class="btn sm accent" data-cal-agendar>Agendar</button></div>` : ''}`
}
const itemDe = k => FILA.find(i => chaveIt(i) === k)
// agenda um post num dia e hora; se ainda não estiver aprovado, pergunta se pode aprovar junto (só sai no horário o que você aprovou)
async function agendarItem(k, ds, hora) {
  const i = itemDe(k); if (!i) return
  if (ds < hoje0()) return pill('Esse dia já passou', 'Escolha hoje ou um dia futuro.', 'var(--amber)')
  hora = hora || (i.agendado ? hhmm(new Date(i.agendado)) : store.get('hora', '09:00'))
  let q = new Date(`${ds}T${hora}`)
  if (q < new Date()) { q = new Date(Date.now() + 36e5); q.setMinutes(0, 0, 0) }
  try {
    if (!i.approved) {
      if (!(await confirmar('Aprovar e agendar?', `"${i.title}" só vai ao ar sozinho se estiver aprovado. Olhe a prévia em Revisar se ainda não leu.`, 'Aprovar e agendar'))) return
      await api('/api/approve', { kind: i.kind, id: i.id })
    }
    await api('/api/agendar', { kind: i.kind, id: i.id, quando: q.toISOString() })
    store.set('hora', hhmm(q)); Som.liga()
    pill('Agendado', `${i.title} · ${q.toLocaleString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`, 'var(--green)')
    CAL.dia = ymd(q); await (atual?.dataset.scene === 'calendario' ? carregarCalendario() : carregarFila())
  } catch (e) { falha(e) }
}
async function tirarDaAgenda(k) {
  const i = itemDe(k); if (!i) return
  try { await api('/api/agendar', { kind: i.kind, id: i.id, quando: null }); Som.desliga(); pill('Fora da agenda', i.title, 'var(--amber)'); await (atual?.dataset.scene === 'calendario' ? carregarCalendario() : carregarFila()) } catch (e) { falha(e) }
}
function abrirNaFila(k) {
  const i = itemDe(k); if (!i) return
  if (i.published) { AG_ABA = 'noar'; voltarPara = null; return cena('calendario') }
  FILTRO = CONTA.pendente(i) ? 'pendente' : CONTA.pronto(i) ? 'pronto' : CONTA.publicado(i) ? 'publicado' : 'todos'
  foco = Math.max(0, visiveis().findIndex(x => chaveIt(x) === k)); verMais = false
  voltarPara = null; cena('fila')
}
const cal = $('[data-scene=calendario]')
cal.addEventListener('click', e => {
  const b = e.target.closest('[data-cal], [data-cal-tirar], [data-cal-fila], [data-cal-agendar]')
  if (b?.dataset.cal) { const m = b.dataset.cal; if (m === 'hoje') { const n = new Date(); CAL = { ano: n.getFullYear(), mes: n.getMonth(), dia: hoje0() } } else { const n = new Date(CAL.ano, CAL.mes + (m === 'prox' ? 1 : -1), 1); CAL.ano = n.getFullYear(); CAL.mes = n.getMonth() } Som.tique(); return desenharCalendario() }
  if (b?.dataset.calTirar) return tirarDaAgenda(b.dataset.calTirar)
  if (b?.dataset.calFila) return abrirNaFila(b.dataset.calFila)
  if (b?.matches('[data-cal-agendar]')) return agendarItem($('[data-cal-add]').value, CAL.dia, $('[data-cal-add-hora]').value)
  const d = e.target.closest('[data-dia]')
  if (d) { CAL.dia = d.dataset.dia; Som.tique(); $$('.cal-d', cal).forEach(x => { x.classList.toggle('sel', x === d); x.tabIndex = x === d ? 0 : -1 }); desenharDia() }
})
cal.addEventListener('change', e => { const t = e.target.closest('[data-cal-hora]'); if (t && t.value) agendarItem(t.dataset.calHora, CAL.dia, t.value) })
// teclado: setas andam pelos dias
cal.addEventListener('keydown', e => {
  const d = e.target.closest('[data-dia]'); if (!d) return
  const passo = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key]
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); return d.click() }
  if (!passo) return
  e.preventDefault()
  const n = new Date(d.dataset.dia + 'T12:00'); n.setDate(n.getDate() + passo); CAL.dia = ymd(n)
  if (n.getMonth() !== CAL.mes) { CAL.ano = n.getFullYear(); CAL.mes = n.getMonth() }
  desenharCalendario(); $(`[data-dia="${CAL.dia}"]`, cal)?.focus()
})
// arrastar e soltar: da lista "Sem data" ou de um dia para outro
cal.addEventListener('dragstart', e => { const a = e.target.closest('[data-arrasta]'); if (!a) return; e.dataTransfer.setData('text/plain', a.dataset.arrasta); e.dataTransfer.effectAllowed = 'move'; a.classList.add('arrastando') })
cal.addEventListener('dragend', e => { e.target.closest('[data-arrasta]')?.classList.remove('arrastando'); $$('.cal-d.alvo', cal).forEach(x => x.classList.remove('alvo')) })
cal.addEventListener('dragover', e => { const d = e.target.closest('[data-dia]'); if (!d || d.dataset.dia < hoje0()) return; e.preventDefault(); $$('.cal-d.alvo', cal).forEach(x => x !== d && x.classList.remove('alvo')); d.classList.add('alvo') })
cal.addEventListener('drop', e => { const d = e.target.closest('[data-dia]'); if (!d) return; e.preventDefault(); d.classList.remove('alvo'); const k = e.dataTransfer.getData('text/plain'); if (k) agendarItem(k, d.dataset.dia) })

// ---------------------------------------------------------------- menu da conta (Ajustes mora aqui)
function desenharMenuConta() {
  if (!ST) return
  const l = ST.linkedin, a = ST.agente, r = ST.reserva
  const P = LIM?.principal, R = LIM?.reserva, I = LIM?.imagem
  const liOk = l.connected && !venceLogo(l)
  // uma barra compacta: rótulo, porcentagem, barra e quando renova
  const mini = j => `<div class="cm-uso"><span>${esc(j.rotulo.replace(' (5 horas)', ''))}</span><b style="color:${corUso(j.pct)}">${j.pct}%</b><i><em style="width:${Math.min(100, j.pct)}%;background:${corUso(j.pct)}"></em></i>${j.renova ? `<small>${renovaTxt(j.renova)}</small>` : ''}</div>`
  const usoIA = x => x && x.medidor ? `<div class="cm-usos">${x.janelas.map(mini).join('')}</div>` : x ? `<p class="cm-nota">${esc(x.nota || 'Esta IA não informa o uso.')}</p>` : ''
  const reserva = !r ? `<div class="cm-linha vazia"><span class="cx-ic sm">${glifo('antigravity')}</span><span class="cm-t"><b>Sem IA reserva</b><small>se a principal chegar ao limite, nada é criado</small></span><button class="btn sm" data-act="res-ligar" data-res="antigravity">Ligar grátis</button></div>`
    : `<div class="cm-linha"><span class="cx-ic sm" style="--c:${r.conectado ? 'var(--green)' : 'var(--amber)'}">${glifo(r.id)}</span><span class="cm-t"><b>${esc(r.nome)} <span class="cm-papel">reserva</span></b><small>${r.conectado ? 'assume se a principal falhar' : 'falta entrar na conta do Google'}</small></span>${r.conectado ? '' : `<button class="btn sm accent" data-act="res-ligar" data-res="${r.id}">Entrar</button>`}</div>${r.conectado ? usoIA(R) : ''}`
  $('#conta-menu').innerHTML = `<div class="cm-h"><span class="avatar" style="${l.foto ? `background-image:url('${esc(l.foto)}');color:transparent` : ''}">${inicial(l.name || 'Você')}</span><span><b>${esc(l.name || 'Você')}</b><small class="${liOk ? 'ok' : 'warn'}">${GLIFO.linkedin}${l.connected ? (venceLogo(l) ? `o acesso vence ${prazo(l.dias)}` : `conectado até ${quando(l.expiresAt)}`) : 'LinkedIn não conectado: nada vai ao ar'}</small></span></div>
    <div class="cm-grupo"><span class="cm-k">Uso das IAs</span>
      <div class="cm-linha"><span class="cx-ic sm" style="--c:${a && a.conectado ? 'var(--green)' : 'var(--amber)'}">${glifo(a ? a.id : '?')}</span><span class="cm-t"><b>${a ? esc(a.nome) : 'Sem IA'} <span class="cm-papel">principal</span></b><small>${a ? (a.conectado ? esc(a.conta || 'conectada') : 'falta entrar na conta') : 'escolha uma em Ajustes'}</small></span></div>
      ${usoIA(P)}
      ${reserva}
    </div>
    ${I ? `<div class="cm-grupo"><span class="cm-k">Imagens com IA</span>
      <div class="cm-linha"><span class="cx-ic sm mg-ic" style="--c:${I.temChave ? 'var(--green)' : 'var(--faint)'}">${GLIFO.magnific}</span><span class="cm-t"><b>Magnific</b><small>${I.temChave ? `${I.operacoes} de ${I.limiteMensal} operações · €${I.gasto.toFixed(2)} de €${I.orcamentoMensal}` : 'sem chave: ligue em Ajustes'}</small></span>${I.temChave && I.site ? `<a class="link cm-ext" href="${esc(urlOk(I.site))}" target="_blank" rel="noopener" title="A API não informa o saldo: veja os créditos no site">saldo ↗</a>` : ''}</div>
      ${I.temChave ? `<div class="cm-usos um">${mini({ rotulo: 'Operações do mês', pct: Math.round(100 * I.operacoes / Math.max(1, I.limiteMensal)) })}</div>` : ''}
    </div>` : ''}
    <button class="cm-versao${ATT?.nova ? ' nova' : ''}" role="menuitem" data-cm-att><span>Vynco ${esc(ATT?.atual || '')}</span><b>${ATT?.nova ? `Nova versão ${esc(ATT.nova.versao.replace(/-.*/, ''))} →` : 'Procurar atualizações'}</b></button>
    <div class="cm-acoes">
      <button role="menuitem" data-cm="ajustes"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="2.2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg><span>Ajustes</span></button>
      <button role="menuitem" data-cm="tour"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m6.2 9.8 1-3 3-1-1 3z" fill="currentColor"/></svg><span>Tour</span></button>
      <button role="menuitem" data-cm="atalhos"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="4" width="13" height="8.5" rx="1.8" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4 7h1M7 7h1M10 7h2M5 9.8h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg><span>Atalhos</span></button>
    </div>`
}
function menuConta(abrir) {
  const m = $('#conta-menu'), b = $('#conns'), on = abrir ?? m.hidden
  if (on) { desenharMenuConta(); carregarLimites() }
  m.hidden = !on; b.setAttribute('aria-expanded', on)
  if (on) $('button', m)?.focus()
}
$('#conta-menu').addEventListener('click', e => { if (e.target.closest('[data-cm-att]')) { menuConta(false); abrirAtualizacao(); if (!ATT?.nova) carregarAtualizacao('agora'); return } const b = e.target.closest('[data-cm]'); if (!b) return; menuConta(false); if (b.dataset.cm === 'atalhos') return $('#atalhos').showModal(); if (b.dataset.cm === 'tour') return tourIniciar(); voltarPara = null; cena(b.dataset.cm) })
document.addEventListener('click', e => { if (!e.target.closest('#conta')) menuConta(false) })
$('#conta-menu').addEventListener('keydown', e => {
  const bs = $$('#conta-menu button'), k = bs.indexOf(document.activeElement)
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); bs[(k + (e.key === 'ArrowDown' ? 1 : bs.length - 1)) % bs.length].focus() }
  if (e.key === 'Escape') { e.stopPropagation(); menuConta(false); $('#conns').focus() }
})
// número de posts esperando você, ao lado de "Fila"
// ---------------------------------------------------------------- fluxo do post: Criar → Revisar → Agendar → No ar
// a mesma faixa aparece em Criar, Fila e Calendário; cada etapa leva para onde aquilo se resolve
let FLUXO_RUNS = 0
function desenharFluxo() {
  const mes = new Date().getMonth()
  const n = {
    criar: FLUXO_RUNS,
    revisar: FILA.filter(i => !i.published && !i.approved && !i.rascunho).length,
    agendar: FILA.filter(i => !i.published && i.approved && !i.rascunho && !i.agendado).length,
    noar: FILA.filter(i => i.agendado && !i.published).length,
  }
  const pub = FILA.filter(i => i.published?.quando && new Date(i.published.quando).getMonth() === mes).length
  const etapas = [
    ['criar', 'Criar', FLUXO_RUNS ? `${FLUXO_RUNS} sendo ${FLUXO_RUNS === 1 ? 'criado' : 'criados'}` : 'peça um post à sua IA'],
    ['revisar', 'Revisar', n.revisar ? `${n.revisar} ${n.revisar === 1 ? 'esperando' : 'esperando'} você` : 'nada esperando'],
    ['agendar', 'Agendar', n.agendar ? `${n.agendar} ${n.agendar === 1 ? 'aprovado' : 'aprovados'} sem data` : 'tudo com data'],
    ['noar', 'No ar', `${n.noar} ${n.noar === 1 ? 'agendado' : 'agendados'} · ${pub} ${pub === 1 ? 'publicado' : 'publicados'} no mês`],
  ]
  for (const nav of $$('[data-fluxo]')) {
    const aqui = nav.dataset.fluxo
    nav.innerHTML = etapas.map(([k, t, sub], i) => `${i ? '<span class="fx-seta" aria-hidden="true"></span>' : ''}<button type="button" class="fx${k === aqui ? ' on' : ''}${(k === 'revisar' && n.revisar) || (k === 'agendar' && n.agendar) ? ' tem' : ''}" data-fx="${k}"${k === aqui ? ' aria-current="step"' : ''}><span class="fx-n">${i + 1}</span><span><b>${t}</b><small>${sub}</small></span></button>`).join('')
  }
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-fx]'); if (!b) return
  const k = b.dataset.fx; Som.tique(); voltarPara = null
  if (k === 'criar') return cena('rotinas')
  if (k === 'revisar') { FILTRO = 'pendente'; foco = 0; return atual?.dataset.scene === 'fila' ? carregarFila() : cena('fila') }
  if (k === 'agendar') { FILTRO = 'pronto'; foco = 0; return atual?.dataset.scene === 'fila' ? carregarFila() : cena('fila') }
  if (k === 'noar') return cena('calendario')
})
// os próximos 7 dias, em cima da fila: o calendário sem sair dela
function desenharSemana() {
  const el = $('[data-semana]'); if (!el) return
  const dias = Array.from({ length: 7 }, (_, k) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + k); return d })
  el.innerHTML = `<span class="sm-t">Próximos 7 dias</span>` + dias.map((d, k) => {
    const ds = ymd(d), ev = FILA.filter(i => (i.agendado && !i.published && ymd(new Date(i.agendado)) === ds) || (i.published?.quando && ymd(new Date(i.published.quando)) === ds))
    return `<button type="button" class="sm-d${ev.length ? ' tem' : ''}${k === 0 ? ' hoje' : ''}" data-semana-dia="${ds}" title="${esc(ev.map(i => i.title).join(' · ') || 'Dia livre')}"><small>${k === 0 ? 'hoje' : DIAS_N[d.getDay()]}</small><b>${d.getDate()}</b><i>${ev.length ? ev.length + (ev.length === 1 ? ' post' : ' posts') : 'livre'}</i></button>`
  }).join('') + '<button type="button" class="link sm-ver" data-view="calendario">Ver o calendário</button>'
}
$('[data-semana]')?.addEventListener('click', e => { const b = e.target.closest('[data-semana-dia]'); if (!b) return; CAL.dia = b.dataset.semanaDia; const d = new Date(CAL.dia + 'T12:00'); CAL.ano = d.getFullYear(); CAL.mes = d.getMonth(); voltarPara = null; cena('calendario') })
// próximo horário livre: o próximo dia útil sem post marcado, no horário de sempre
function proximoLivre() {
  const [hh, mm] = store.get('hora', '09:00').split(':').map(Number)
  const ocupado = new Set(FILA.filter(i => i.agendado && !i.published).map(i => ymd(new Date(i.agendado))))
  const d = new Date(); d.setHours(hh, mm, 0, 0); if (d <= new Date()) d.setDate(d.getDate() + 1)
  for (let k = 0; k < 60; k++) { if (![0, 6].includes(d.getDay()) && !ocupado.has(ymd(d))) return d; d.setDate(d.getDate() + 1) }
  return d
}
function contarFila() { desenharFluxo(); desenharSemana(); { const lim = Date.now() + 7 * 864e5, na = FILA.filter(i => i.agendado && !i.published && new Date(i.agendado).getTime() <= lim).length, e = $('[data-nav-n=agenda]'); if (e) { e.hidden = !na; e.textContent = na; e.setAttribute('aria-label', `${na} agendados nos próximos 7 dias`) } } const n = FILA.filter(CONTA.pendente).length, el = $('[data-nav-n=fila]'); el.hidden = !n; el.textContent = n; el.setAttribute('aria-label', `${n} ${n === 1 ? 'post esperando' : 'posts esperando'} você`) }

// ---------------------------------------------------------------- ajustes
function desenharAjustes() {
  if (!ST) return
  const { linkedin: l, agente: a, desigma: d, config } = ST
  const linha = (k, cor, txt, acoes) => { const r = $(`[data-conn="${k}"]`); $('.c-ic', r).style.setProperty('--c', cor); $('[data-conn-t]', r).textContent = txt; $('[data-conn-a]', r).innerHTML = acoes }
  $('[data-conn=linkedin] .c-ic').innerHTML = GLIFO.linkedin
  const contas = l.contas || [], vence = venceLogo(l)
  linha('linkedin', !l.connected ? (contas.length ? 'var(--red)' : 'var(--amber)') : vence ? 'var(--amber)' : 'var(--green)',
    l.connected ? `${l.name} · ${vence ? `vence ${prazo(l.dias)}: reconecte para continuar publicando` : 'válido até ' + quando(l.expiresAt)}` : contas.length ? `O acesso de ${contas.find(c => c.ativa)?.nome || contas[0].nome} venceu: reconecte para publicar.` : 'Não conectado: sem isso nada vai ao ar.',
    l.connected || contas.length ? `<button class="btn sm${vence || !l.connected ? ' accent' : ''}" data-act="li-again">Reconectar</button><button class="link" data-act="li-add">Outra conta</button><button class="link soft" data-act="li-off">Desconectar</button>` : '<button class="btn sm accent" data-act="li-again">Conectar</button>')
  // várias contas: lista com "Usar" (a conta em uso é a que publica)
  const box = $('[data-li-contas]')
  box.hidden = contas.length < 2
  box.innerHTML = contas.map(c => `<div class="acc${c.ativa ? ' on' : ''}"><span class="avatar sm" style="${c.foto ? `background-image:url('${esc(c.foto)}');color:transparent` : ''}">${inicial(c.nome)}</span><span class="c-t"><b>${esc(c.nome)}</b><small>${c.valida ? 'válido até ' + quando(c.expiresAt) : 'acesso vencido'}</small></span>${c.ativa ? '<span class="ok-badge">em uso</span>' : `<button class="link" data-usar="${esc(c.id)}">Usar esta</button>`}</div>`).join('')
  $('[data-conn=agente] [data-conn-ic]').innerHTML = glifo(a ? a.id : '?')
  $('[data-conn=agente] [data-conn-n]').textContent = a ? `${a.nome} · ${a.via}` : 'IA'
  linha('agente', a && a.conectado ? 'var(--green)' : 'var(--amber)', a ? (a.conectado ? `${a.conta || 'conectado'}${a.sincronizado ? ' · sincronizado em ' + quando(Date.parse(a.sincronizado)) : ' · falta sincronizar'}` : 'Falta entrar na conta') : 'Nenhuma IA escolhida.',
    `${a ? '<button class="btn sm" data-act="sync-again">Sincronizar de novo</button>' : ''}<button class="${a ? 'link' : 'btn sm accent'}" data-goscene="agente">${a ? 'Trocar' : 'Escolher'}</button>`)
  desenharReserva(); desenharStandby(); carregarModelos(); carregarAtualizacao()
  const dok = d.mcpOk
  linha('desigma', dok ? (d.registered ? 'var(--green)' : 'var(--amber)') : 'var(--faint)', dok ? (d.registered ? 'Ligado à sua IA: cada peça vira um quadro editável.' : 'Encontrado. Sincronize para ligar à sua IA.') : 'Não encontrado neste computador. É opcional.',
    dok ? '' : '<a class="link" href="https://github.com/deepfounder-ai/desigma/releases" target="_blank" rel="noopener">Baixar</a>')
  const f = $('[data-form=desigma]'); for (const k of ['exe', 'mcpExe', 'workspace', 'project']) if (document.activeElement !== f[k]) f[k].value = d[k] || ''
  const fc = $('[data-form=config]'); if (document.activeElement !== fc.assetsDir) fc.assetsDir.value = config.assetsDir || ''; if (document.activeElement !== fc.dailyUiStart) fc.dailyUiStart.value = config.dailyUiStart || ''
  marcarPrefs()
}
// o campo do código sobrevive aos redesenhos do login (que acontecem a cada poucos segundos)
const comCodigo = fn => { const el = $('[data-res-codigo]'), v = el?.value || '', foco = document.activeElement === el; fn(); const n = $('[data-res-codigo]'); if (n && v) n.value = v; if (n && foco) n.focus() }
function desenharReserva() { comCodigo(desenharReserva0) }
function desenharReserva0() {
  if (!ST) return
  const r = ST.reserva, x = LIM?.reserva, row = $('[data-conn=reserva]'); if (!row) return
  $('[data-res-ic]', row).innerHTML = glifo(r ? r.id : 'antigravity')
  const GRATIS = ST.agente?.id === 'antigravity' ? 'claude' : 'antigravity', velho = r && r.id === 'gemini'
  $('[data-res-n]', row).innerHTML = r ? `IA reserva · ${esc(r.nome)}` : 'IA reserva <small class="opt">recomendado</small>'
  $('.c-ic', row).style.setProperty('--c', r ? (r.conectado ? 'var(--green)' : 'var(--amber)') : 'var(--faint)')
  $('[data-conn-t]', row).innerHTML = r ? (r.conectado ? `Se a principal chegar ao limite ou falhar, o ${esc(r.nome)} cria no lugar. O post vai para Revisar como sempre.${r.sincronizado ? '' : ' Falta sincronizar.'}` : `Falta entrar na conta do ${esc(r.nome)}.`) + (x ? `<span class="uso-mini">${barrasUso(x)}</span>` : '')
    : 'Quando a sua IA chega ao limite de uso, o Vynco não cria nada. Com uma reserva, outra IA assume. O Antigravity, do Google, é grátis com uma conta Google (cota semanal).'
  if (velho) $('[data-conn-t]', row).innerHTML = '<span class="res-aviso">O Google desligou o plano grátis do Gemini CLI em junho de 2026, então esta reserva não funciona mais. Troque para o Antigravity, que é o substituto grátis.</span>'
  if (velho && !RES_ON) { $('[data-conn-a]', row).innerHTML = '<button class="btn sm accent" data-act="res-ligar" data-res="antigravity">Trocar para o Antigravity</button><button class="link soft" data-act="res-tirar">Tirar</button>'; return }
  $('[data-conn-a]', row).innerHTML = RES_ON ? `<span class="soft">${esc(RES_ON)}</span>${RES_CODIGO ? `<span class="res-codigo"><input data-res-codigo placeholder="O navegador mostrou um código? Cole aqui" autocomplete="off" spellcheck="false"><button class="btn sm" data-act="res-codigo" data-res="${RES_CODIGO}">Enviar</button></span>` : ''}${RES_JANELA ? `<button class="link" data-act="res-janela" data-res="${RES_JANELA}">Não abriu? Abrir numa janela</button>` : ''}` : r ? `${r.conectado && r.sincronizado ? '' : `<button class="btn sm accent" data-act="res-ligar" data-res="${r.id}">Terminar</button>`}<button class="link soft" data-act="res-tirar">Tirar</button>`
    : `<button class="btn sm accent" data-act="res-ligar" data-res="${GRATIS}">Usar o ${GRATIS === 'claude' ? 'Claude' : 'Antigravity'}${ST.agente?.id === 'gemini' ? '' : ' (grátis)'}</button>`
}
let RES_ON = '', RES_JANELA = '', RES_CODIGO = ''
async function ligarReserva(id) {
  const nome = { claude: 'Claude', antigravity: 'Antigravity', gemini: 'Gemini', codex: 'ChatGPT' }[id] || id
  const passo = t => { RES_ON = t; desenharReserva() }
  try {
    passo('Conferindo…')
    let r = await api('/api/agente/reserva', { id })
    if (!r.conectado) {
      passo(r.instalado ? `Abrindo o login do ${nome}…` : `Instalando o ${nome}…`)
      let j = await api('/api/agente/login', { id })
      const t0 = Date.now()
      while (!['ok', 'erro'].includes(j.fase)) { await espera(DEMO ? 300 : 1500); j = await api('/api/agente/job?id=' + id); if (!j.fase) break; RES_JANELA = Date.now() - t0 > 20000 ? id : ''; RES_CODIGO = j.codigo && j.fase === 'esperando' ? id : ''; passo(j.fase === 'esperando' && j.codigo ? 'Entre com a sua conta Google no navegador que abriu' : (j.msg || 'Entrando…')) }
      RES_CODIGO = ''
      RES_JANELA = ''
      if (j.fase !== 'ok') throw new Error(j.msg || `Não deu para entrar no ${nome}.`)
    }
    passo('Ensinando as regras do Vynco…')
    let s2; try { s2 = await api('/api/sync', { id, reserva: true }) } catch (e) { if (e.status !== 409) throw e; s2 = await api('/api/sync') }
    while (!s2.fim) { await espera(DEMO ? 220 : 800); s2 = await api('/api/sync') }
    if (s2.passos?.some(p => p.estado === 'falhou')) throw new Error(s2.passos.find(p => p.estado === 'falhou').detalhe || 'a sincronização falhou')
    Som.liga(); pill(`${nome} é a sua IA reserva`, 'Se a principal chegar ao limite, ele assume.', 'var(--green)')
  } catch (e) { falha(e) } finally { RES_ON = ''; ST = null; await status(); carregarLimites(true); desenharReserva() }
}
// ---------------------------------------------------------------- modelo e esforço (Ajustes)
let IA_MOD = null
const ESF_NOME = { '': 'Automático', low: 'Baixo', medium: 'Médio', high: 'Alto', xhigh: 'Muito alto', max: 'Máximo' }
const TAREFA = { criar: ['Criar posts', 'as rotinas, o modo automático e "Criar agora"'], ler: ['Ler e pesquisar', 'análise do perfil, Conexões e Vagas'] }
async function carregarModelos() {
  try { IA_MOD = await api('/api/ia/modelos'); desenharModelos() } catch (e) { $('[data-ia-lista]').innerHTML = `<p class="set-sub">${esc(e.message)}</p>` }
}
function desenharModelos() {
  const box = $('[data-ia-lista]'); if (!box || !IA_MOD) return
  if (!IA_MOD.ias.length) { box.innerHTML = '<p class="set-sub">Conecte o Claude, o ChatGPT ou o Antigravity para escolher modelo e esforço. As outras IAs usam o padrão delas.</p>'; return }
  // dica pelo uso de agora
  const pr = LIM?.principal, sess = pr?.janelas?.[0]?.pct, dica = $('[data-ia-dica]')
  dica.hidden = sess == null
  if (sess != null) dica.innerHTML = sess >= 70 ? `A sessão da sua IA está em <b>${sess}%</b>. O modo <b>Econômico</b> ajuda a chegar até a renovação.` : `A sessão da sua IA está em <b>${sess}%</b>. Dá para usar o <b>Equilibrado</b> ou o <b>Caprichado</b> com folga.`
  box.innerHTML = IA_MOD.ias.map(ia => `<div class="ia-bloco" data-ia="${ia.id}">
      <div class="ia-cab"><span class="c-ic">${glifo(ia.id)}</span><b>${esc(ia.nome)}</b>${ia.papel ? `<small class="tag">${ia.papel}</small>` : ''}</div>
      ${Object.entries(TAREFA).map(([tipo, [nome, sub]]) => { const e = ia.escolha[tipo] || {}; return `<div class="ia-linha" data-tipo="${tipo}">
        <span class="ia-t"><b>${nome}</b><small>${sub}</small></span>
        <label class="ia-m">${ia.livre ? `<input data-ia-modelo value="${esc(e.modelo || '')}" placeholder="Padrão da conta" spellcheck="false" autocomplete="off" aria-label="Modelo para ${nome}">`
          : `<select data-ia-modelo aria-label="Modelo para ${nome}"><option value="">Padrão da conta</option>${ia.modelos.map(m => `<option value="${esc(m.v)}"${m.v === e.modelo ? ' selected' : ''}>${esc(m.n)}${m.d ? ' · ' + esc(m.d) : ''}</option>`).join('')}</select>`}</label>
        <span class="ia-esf" role="radiogroup" aria-label="Esforço para ${nome}">${['', ...IA_MOD.esforcos].map(v => `<button type="button" role="radio" aria-checked="${(e.esforco || '') === v}" data-ia-esf="${v}" title="${ESF_NOME[v]}">${ESF_NOME[v]}</button>`).join('')}</span>
      </div>` }).join('')}
      ${ia.id === 'codex' ? '<p class="ia-nota">No ChatGPT (Codex), o esforço vai até "Alto": "Muito alto" e "Máximo" usam o alto.</p>' : ''}
    </div>`).join('')
}
async function salvarModelo(id, tipo, patch, quieto) {
  const ia = IA_MOD.ias.find(i => i.id === id), atual = { ...(ia.escolha[tipo] || {}), ...patch }
  ia.escolha[tipo] = atual
  try { await api('/api/ia/modelos', { id, tipo, modelo: atual.modelo || '', esforco: atual.esforco || '' }); if (!quieto) pill('Salvo', `${ia.nome} · ${TAREFA[tipo][0]}: ${atual.modelo ? (ia.modelos.find(m => m.v === atual.modelo)?.n || atual.modelo) : 'modelo padrão'}, esforço ${ESF_NOME[atual.esforco || ''].toLowerCase()}`, 'var(--green)') } catch (e) { falha(e) }
}
// modos prontos: escolhem modelo e esforço das duas tarefas de cada IA
function modoPronto(modo, ia) {
  const ach = re => (ia.modelos.find(m => re.test(m.v)) || {}).v || ''
  const M = {
    economico: { claude: [['sonnet', 'low'], ['haiku', 'low']], antigravity: [[ach(/flash.*low|flash/), 'low'], [ach(/flash.*low|flash/), 'low']], codex: [['', 'low'], ['', 'low']] },
    equilibrado: { claude: [['sonnet', 'medium'], ['sonnet', 'low']], antigravity: [[ach(/flash.*high|flash/), 'medium'], [ach(/flash.*low|flash/), 'low']], codex: [['', 'medium'], ['', 'low']] },
    caprichado: { claude: [['opus', 'high'], ['sonnet', 'medium']], antigravity: [[ach(/opus/), 'high'], [ach(/sonnet/), 'medium']], codex: [['', 'high'], ['', 'medium']] },
    padrao: {},
  }[modo][ia.id] || [['', ''], ['', '']]
  return { criar: { modelo: M[0][0], esforco: M[0][1] }, ler: { modelo: M[1][0], esforco: M[1][1] } }
}
document.addEventListener('click', async e => {
  const m = e.target.closest('[data-ia-modo]')
  if (m) {
    for (const ia of IA_MOD?.ias || []) { const p = modoPronto(m.dataset.iaModo, ia); for (const tipo of ['criar', 'ler']) await salvarModelo(ia.id, tipo, p[tipo], true) }
    desenharModelos(); Som.tique?.(); return pill(`Modo ${m.querySelector('b').textContent.toLowerCase()}`, 'Modelo e esforço escolhidos para todas as suas IAs.', 'var(--green)')
  }
  const b = e.target.closest('[data-ia-esf]'); if (!b) return
  const linha = b.closest('[data-tipo]'), id = b.closest('[data-ia]').dataset.ia
  linha.querySelectorAll('[data-ia-esf]').forEach(x => x.setAttribute('aria-checked', String(x === b)))
  salvarModelo(id, linha.dataset.tipo, { esforco: b.dataset.iaEsf })
})
document.addEventListener('change', e => {
  const c = e.target.closest('[data-ia-modelo]'); if (!c) return
  salvarModelo(c.closest('[data-ia]').dataset.ia, c.closest('[data-tipo]').dataset.tipo, { modelo: c.value.trim() })
})

// ---------------------------------------------------------------- atualizações (procura no GitHub, baixa, confere e instala)
let ATT = null, attTimer = null
const mb = b => b ? (b / 1048576).toFixed(0) + ' MB' : ''
// notas da versão: texto simples, com "- item" virando lista e **negrito** respeitado (tudo escapado antes)
function notasHtml(t) {
  const linhas = String(t || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).slice(0, 14)
  const neg = x => esc(x).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>')
  let html = '', lista = false
  for (const l of linhas) {
    if (/^[-*] /.test(l)) { if (!lista) { html += '<ul>'; lista = true } html += `<li>${neg(l.slice(2))}</li>`; continue }
    if (lista) { html += '</ul>'; lista = false }
    html += /^#+ /.test(l) ? `<p class="att-h">${neg(l.replace(/^#+ /, ''))}</p>` : `<p>${neg(l)}</p>`
  }
  return html + (lista ? '</ul>' : '')
}
async function carregarAtualizacao(procurar) {
  try { ATT = await api('/api/atualizacao' + (procurar ? '?procurar=' + procurar : '')) } catch { return }
  desenharAtualizacao(); marcarAtualizacao()
  clearTimeout(attTimer)
  if (ATT.download?.fase === 'baixando') attTimer = setTimeout(() => carregarAtualizacao(), DEMO ? 600 : 1000)
}
function desenharAtualizacao() {
  const box = $('[data-att-corpo]'); if (!box || !ATT) return
  $('[data-att-v]').textContent = `você está na versão ${ATT.atual}`
  $('[data-att-avisar]').checked = ATT.avisar
  const procurada = ATT.procurada ? `Procurado ${quando(Date.parse(ATT.procurada))} às ${new Date(ATT.procurada).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.` : ''
  if (!ATT.nova) {
    box.innerHTML = `<div class="att-ok"><span class="att-ic ok" aria-hidden="true">✓</span><span><b>${ATT.erro ? 'Não deu para procurar agora' : 'Você está na versão mais nova'}</b><small>${esc(ATT.erro || procurada)}</small></span><button class="btn sm" type="button" data-att="procurar">Procurar agora</button></div>`
    return
  }
  const n = ATT.nova, d = ATT.download
  const acao = !n.instalavel ? `<a class="btn sm accent" href="${esc(n.pagina)}" target="_blank" rel="noopener">Abrir a página da versão</a>`
    : !d || d.fase === 'erro' ? `<button class="btn accent" type="button" data-att="baixar">Baixar e instalar${n.tamanho ? ` · ${mb(n.tamanho)}` : ''}</button>`
    : d.fase === 'baixando' ? `<div class="att-prog"><span><i style="width:${Math.round(100 * d.feito / Math.max(1, d.total))}%"></i></span><small>Baixando… ${mb(d.feito)} de ${mb(d.total)}</small></div>`
    : `<button class="btn accent" type="button" data-att="instalar">Instalar agora</button><small class="att-dica">O Vynco fecha e o instalador abre. Os seus posts, a agenda e as conexões ficam onde estão.</small>`
  box.innerHTML = `<div class="att-nova">
      <div class="att-cab"><span class="att-ic novo" aria-hidden="true">↑</span><span><b>Versão ${esc(n.versao.replace(/-.*/, ''))} disponível</b><small>${n.publicada ? 'publicada ' + quando(Date.parse(n.publicada)) : ''}${n.tamanho ? ' · ' + mb(n.tamanho) : ''}</small></span></div>
      ${n.notas ? `<div class="att-notas"><span class="cm-k">O que mudou</span>${notasHtml(n.notas)}</div>` : ''}
      ${d?.fase === 'erro' ? `<p class="att-erro">${esc(d.erro)}</p>` : ''}
      <div class="att-acoes">${acao}<a class="link" href="${esc(n.pagina)}" target="_blank" rel="noopener">Ver no GitHub</a></div>
      <p class="fine">O Vynco confere a impressão digital (SHA-256) do instalador com a publicada no GitHub antes de abrir.</p>
    </div>`
}
// bolinha no botão da conta e aviso uma vez por versão
function marcarAtualizacao() {
  const nova = ATT?.nova
  $('#conns')?.classList.toggle('tem-att', !!nova)
  if (nova && ATT.avisar && store.get('att-avisada') !== nova.versao && !$('#atualizacoes')?.offsetParent) {
    store.set('att-avisada', nova.versao)
    avisoFixo({ tipo: 'info', titulo: `Vynco ${nova.versao.replace(/-.*/, '')} disponível`, texto: 'Instale sem sair do app.', acao: { rotulo: 'Ver novidades', fn: abrirAtualizacao } })
  }
}
function abrirAtualizacao() { voltarPara = null; cena('ajustes'); setTimeout(() => $('#atualizacoes')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350) }
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-att]'); if (!b) return
  const q = b.dataset.att; b.disabled = true
  try {
    if (q === 'procurar') { b.textContent = 'Procurando…'; await carregarAtualizacao('agora'); if (!ATT.nova && !ATT.erro) pill('Tudo em dia', `Você já está na versão mais nova (${ATT.atual}).`, 'var(--green)') }
    if (q === 'baixar') { ATT = await api('/api/atualizacao/baixar', {}); Som.tique(); carregarAtualizacao() }
    if (q === 'instalar') {
      if (!(await confirmar('Instalar a versão nova?', 'O Vynco fecha e o instalador abre. Os seus posts, a agenda e as conexões ficam onde estão. Depois, é só abrir o Vynco de novo.', 'Instalar agora'))) { b.disabled = false; return }
      await api('/api/atualizacao/instalar', {}); pill('Abrindo o instalador…', 'O Vynco vai fechar em instantes.', 'var(--violet)')
    }
  } catch (err) { falha(err); b.disabled = false; carregarAtualizacao() }
})
document.addEventListener('change', async e => { if (e.target.matches('[data-att-avisar]')) { try { ATT = await api('/api/atualizacao/avisar', { avisar: e.target.checked }); Som.tique() } catch (err) { falha(err) } } })

function desenharStandby() {
  const box = $('[data-standby]'); if (!box || !ST) return
  const sb = ST.standby || {}; box.hidden = !sb.disponivel
  $$('[data-standby-v]', box).forEach(b => b.classList.toggle('on', (b.dataset.standbyV === '1') === !!sb.ligado))
}
$('[data-standby]')?.addEventListener('click', async e => {
  const b = e.target.closest('[data-standby-v]'); if (!b) return
  try { const sb = await api('/api/standby', { ligar: b.dataset.standbyV === '1' }); if (ST) ST.standby = sb; Som.tique(); desenharStandby(); pill(sb.ligado ? 'O Vynco abre com o Windows' : 'O Vynco não abre mais com o Windows', sb.ligado ? 'Ele fica na bandeja e publica no horário.' : 'Lembre de abrir o app nos horários agendados.', sb.ligado ? 'var(--green)' : 'var(--amber)'); if (atual?.dataset.scene === 'inicio') desenharInicio() } catch (err) { falha(err) }
})
function marcarPrefs() { for (const g of $$('[data-pref]')) { const v = store.get(g.dataset.pref, { theme: 'auto', sound: 'tom', toast: 'padrao' }[g.dataset.pref]); $$('button', g).forEach(b => b.classList.toggle('on', b.dataset.v === v)) } }
$$('[data-pref] button').forEach(b => b.addEventListener('click', () => {
  const k = b.closest('[data-pref]').dataset.pref; store.set(k, b.dataset.v); marcarPrefs()
  if (k === 'theme') aplicarTema()
  if (k === 'sound') Som.liga(); else Som.tique()
  if (k === 'toast') pill('Assim fica o aviso', 'Daily UI 003 · esperando você', 'var(--amber)')
}))

// ---------------------------------------------------------------- cliques e formulários
// na versão desktop (janela do Tauri), links externos e arquivos abrem fora do app: no navegador e no programa padrão
function abrirFora(url) {
  if (!ST?.desktop) return window.open(url, '_blank', 'noopener')
  api('/api/abrir', { url: new URL(url, location.href).origin === location.origin ? new URL(url, location.href).pathname : url }).catch(falha)
}
document.addEventListener('click', e => {
  const a = e.target.closest('a[target=_blank]')
  if (a && ST?.desktop && !e.defaultPrevented) { e.preventDefault(); abrirFora(a.getAttribute('href')) }
}, true)
document.addEventListener('click', async e => {
  if (!e.target.closest('.dd')) menuOutros(false)
  const t = e.target.closest('button, a'); if (!t) return
  if (t.matches('[data-next]')) return proximaCena()
  if (t.matches('[data-finish]')) return terminar()
  if (t.matches('[data-view]')) { voltarPara = null; return cena(t.dataset.view) }
  if (t.matches('[data-goscene]')) { const de = atual.dataset.scene; voltarPara = ['fila', 'rotinas', 'ajustes', 'perfil', 'calendario', 'rede', 'biblioteca'].includes(de) ? de : voltarPara; return cena(t.dataset.goscene) }
  if (t.matches('[data-run]')) return rodar(t.dataset.run)
  if (t.matches('[data-agent]')) return entrarCom(t.dataset.agent)
  if (t.matches('[data-novo-post]')) return abrirEditor({})
  if (t.matches('[data-gerar-img]')) return abrirEstudio({ op: 'gerar' })
  if (t.matches('[data-es-ajustes]')) { $('#estudio').close(); voltarPara = null; return cena('ajustes') }
  if (t.matches('[data-ed]')) {
    const q = t.dataset.ed
    if (q === 'salvar') return salvarEd()
    if (q === 'enviar') return salvarEd({ enviar: true })
    if (q === 'biblioteca') return abrirPicker()
    if (q === 'gerar') return abrirEstudio({ op: 'gerar', contexto: 'editor', prompt: (ED?.legenda || '').split('\n').filter(l => l.trim() && !l.trim().startsWith('#')).slice(0, 2).join(' ').slice(0, 300) })
    if (q === 'descartar') {
      if (ED?.sujo && !(await confirmar('Descartar as mudanças?', ED.id ? 'O post volta a ser como estava da última vez que foi salvo.' : 'O que você escreveu aqui não será salvo.', 'Descartar'))) return
      ED = null; const v = voltarPara || 'fila'; voltarPara = null; return cena(v)
    }
    return
  }
  if (t.matches('[data-usar]')) { try { await api('/api/linkedin/usar', { id: t.dataset.usar }); Som.liga(); await status(); pill('Conta em uso', `Os posts saem como ${ST.linkedin.name}`, 'var(--green)') } catch (err) { falha(err) } return }
  if (t.matches('[data-copy]')) { try { await navigator.clipboard.writeText(t.dataset.copy); Som.tique(); pill('Copiado') } catch { pill('Não consegui copiar', 'Selecione o texto e copie à mão.', 'var(--amber)') } return }
  if (t.matches('[data-close]')) return t.closest('dialog').close()
  if (t.matches('[data-atalhos]')) { Som.tique(); return $('#atalhos').showModal() }
  if (t.id === 'back') return voltar()
  if (t.id === 'conns') return menuConta()
  const act = t.dataset.act; if (!act) return
  try {
    if (act === 'res-ligar') return ligarReserva(t.dataset.res)
    if (act === 'res-codigo') { const c = $('[data-res-codigo]')?.value || ''; await api('/api/agente/codigo', { id: t.dataset.res, codigo: c }); Som.tique(); return pill('Código enviado', 'Esperando a confirmação do Google…', 'var(--violet)') }
    if (act === 'res-janela') { await api('/api/agente/login', { id: t.dataset.res, console: true }); return pill('Abri uma janela de login', 'Siga o que aparece nela. O Vynco percebe sozinho quando terminar.', 'var(--violet)') }
    if (act === 'res-tirar') { await api('/api/agente/reserva', { id: null }); ST = null; await status(); Som.desliga(); return pill('Sem IA reserva', 'Se a principal chegar ao limite, nada é criado até ela voltar.', 'var(--amber)') }
    if (act === 'standby-ligar') { const sb = await api('/api/standby', { ligar: true }); if (ST) ST.standby = sb; Som.liga(); pill('O Vynco abre com o Windows', 'Ele fica na bandeja e publica no horário.', 'var(--green)'); return desenharInicio() }
    if (act === 'li-connect' || act === 'li-reopen') return conectarLinkedin()
    if (act === 'li-cancel') return cancelarLinkedin()
    if (act === 'li-proprio') return abrirAssistente()
    if (act === 'li-again') { voltarPara = atual.dataset.scene; cena('linkedin'); return setTimeout(conectarLinkedin, 450) }
    if (act === 'li-add') { if (await confirmar('Entrar com outra conta?', 'Antes, saia do LinkedIn no navegador (ou use outro perfil do navegador). Senão o LinkedIn entra direto com a conta que já está aberta.', 'Continuar')) { voltarPara = atual.dataset.scene; cena('linkedin'); setTimeout(conectarLinkedin, 450) } return }
    if (act === 'li-off') {
      const c = (ST?.linkedin?.contas || []).find(x => x.ativa), varias = (ST?.linkedin?.contas || []).length > 1
      if (await confirmar(`Desconectar ${c ? c.nome : 'o LinkedIn'}?`, varias ? 'A outra conta conectada passa a ser a usada para publicar.' : 'O Vynco para de conseguir publicar até você conectar de novo.', 'Desconectar')) { await api('/api/linkedin/disconnect', c ? { id: c.id } : {}); Som.desliga(); status() }
      return
    }
    if (act === 'outros') return menuOutros()
    if (act === 'login-console') return LOGIN && entrarCom(LOGIN.id, { console: true })
    if (act === 'login-cancel') return cancelarLogin()
    if (act === 'sync-again') { if (atual.dataset.scene === 'sync') { $('[data-sync-cta]').hidden = true; return entrarSync() } voltarPara = atual.dataset.scene; return cena('sync') }
  } catch (err) { falha(err) }
})
const form = (sel, fn) => $(sel).addEventListener('submit', async e => { e.preventDefault(); try { await fn(e.target); Som.liga(); status() } catch (err) { falha(err) } })
form('[data-form=linkedin-keys]', async f => {
  await api('/api/linkedin/keys', { client_id: f.client_id.value, client_secret: f.client_secret.value }); f.client_secret.value = ''
  $('#proprio').close(); pill('Chaves salvas', 'Só neste computador', 'var(--green)')
  if (atual?.dataset.scene !== 'linkedin') { voltarPara = atual.dataset.scene; cena('linkedin') }
  setTimeout(() => conectarLinkedin(true), 400)
})
form('[data-form=desigma]', async f => { await api('/api/desigma/config', { exe: f.exe.value, mcpExe: f.mcpExe.value, workspace: f.workspace.value, project: f.project.value }); pill('Caminhos salvos', 'Sincronizando com a sua IA…', 'var(--green)'); if (ST?.agente) { voltarPara = 'ajustes'; cena('sync') } })
form('[data-form=config]', async f => { const r = await api('/api/config', { assetsDir: f.assetsDir.value, dailyUiStart: f.dailyUiStart.value }); pill('Salvo', r.msg, 'var(--green)') })
// a chave é conferida com o Magnific (sem gastar créditos) antes de ir para o cofre; o campo é limpo em seguida
form('[data-form=img-chave]', async f => { if (!f.chave.value.trim()) return pill('Cole a chave antes', '', 'var(--amber)'); pill('Conferindo a chave…', '', 'var(--violet)'); try { await api('/api/imagem/chave', { provedor: 'magnific', chave: f.chave.value }) } finally { f.chave.value = '' } pill('Chave conferida e salva', 'Fica só no cofre deste computador.', 'var(--green)'); carregarImgAjustes() })
form('[data-form=img-config]', async f => { await api('/api/imagem/config', { limiteMensal: f.limiteMensal.value, orcamentoMensal: f.orcamentoMensal.value }); pill('Limites salvos', '', 'var(--green)'); carregarImgAjustes() })

// ---------------------------------------------------------------- teclado (Enter avança; Esc volta; A, P, ← e → na fila)
const lit = (k, on) => $$(`kbd[data-k="${k}"]`).forEach(x => x.classList.toggle('lit', on))
// Ctrl+S salva o rascunho no editor (vale também com o cursor no texto)
addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && ['editor', 'perfil'].includes(atual?.dataset.scene)) { e.preventDefault(); atual.dataset.scene === 'editor' ? salvarEd() : salvarPerfil() } })
addEventListener('keydown', e => {
  if (atual?.dataset.scene === 'voce' && !$('dialog[open]') && !e.target.closest('textarea, select')) { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; if ((k !== 'Enter' || !e.target.closest('button, a')) && teclaVoce(e, k)) return }
  if (e.target.closest('input, textarea, select') || $('dialog[open]')) return
  if (e.key === '?') { e.preventDefault(); menuConta(false); return $('#atalhos').showModal() }
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key
  const nome = atual?.dataset.scene
  lit({ ArrowLeft: '←', ArrowRight: '→' }[k] || k, true)
  if (k === 'Escape') { if (!$('#conta-menu').hidden) return menuConta(false); if ($('.dd[data-open]')) return menuOutros(false); if (ONB.includes(nome) || voltarPara) return voltar() }
  if (k === 'Enter' && ONB.includes(nome) && !e.target.closest('button, a, summary')) {
    e.preventDefault()
    if (nome === 'ola') return proximaCena()
    if (nome === 'linkedin') return $('[data-li]').dataset.li === 'ok' ? proximaCena() : $('[data-li]').dataset.li === 'idle' ? conectarLinkedin() : null
    if (nome === 'sync') return !$('[data-sync-cta]').hidden && $('[data-sync-cta] [data-next]') ? proximaCena() : null
    if (nome === 'estrategia') return $('[data-est-cta] .btn.accent')?.click()
  }
  if (nome === 'fila') {
    if (k === 'ArrowRight' || k === 'ArrowLeft') { e.preventDefault(); foco += k === 'ArrowRight' ? 1 : -1; verMais = false; Som.tique(); desenharFila(); $(`[data-strip] .post[data-n="${foco}"]`)?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' }) }
    if (k === 'a') acao('toggle')
    if (k === 'p') acao('publish')
  }
})
addEventListener('keyup', e => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; lit({ ArrowLeft: '←', ArrowRight: '→' }[k] || k, false) })

// ---------------------------------------------------------------- avisos que ficam (erros e coisas que terminaram enquanto você fazia outra coisa)
// a pílula do topo continua para confirmações rápidas; o que precisa de atenção fica aqui até você fechar ou clicar
function avisoFixo({ tipo = 'info', titulo, texto = '', acao = null }) {
  const box = $('#avisos'); if (!box) return
  const el = document.createElement('div'); el.className = 'aviso-fixo ' + tipo; el.setAttribute('role', tipo === 'erro' ? 'alert' : 'status')
  el.innerHTML = `<span class="af-ic" aria-hidden="true"></span><span class="af-t"><b>${esc(titulo)}</b>${texto ? `<small>${esc(texto)}</small>` : ''}</span>${acao ? `<button class="btn sm${tipo === 'erro' ? '' : ' accent'}" type="button" data-af-acao>${esc(acao.rotulo)}</button>` : ''}<button class="af-x" type="button" aria-label="Fechar aviso">×</button>`
  el.querySelector('.af-x').onclick = () => el.remove()
  if (acao) el.querySelector('[data-af-acao]').onclick = () => { el.remove(); acao.fn() }
  box.prepend(el)
  while (box.children.length > 4) box.lastElementChild.remove()
  // some sozinho (o mouse em cima pausa); erro fica um pouco mais, para dar tempo de ler
  const dur = tipo === 'erro' ? 14000 : 7000, sair = () => { el.classList.add('saindo'); setTimeout(() => el.remove(), 260) }
  el.style.setProperty('--dur', dur + 'ms'); el.insertAdjacentHTML('beforeend', '<i class="af-tempo" aria-hidden="true"></i>')
  let resta = dur, ini = Date.now(), t = setTimeout(sair, dur)
  el.addEventListener('mouseenter', () => { clearTimeout(t); resta -= Date.now() - ini; el.classList.add('pausa') })
  el.addEventListener('mouseleave', () => { ini = Date.now(); t = setTimeout(sair, Math.max(1500, resta)); el.classList.remove('pausa') })
}

// ---------------------------------------------------------------- o que a sua IA está fazendo (de qualquer tela)
let ATIV = { rotinas: [], analise: null, rede: null, avisos: [] }, ativT = null, ativPrimeira = true
const ATIV_VISTO = { runs: {}, analise: null, rede: null, aviso: +store.get('aviso-visto', 0) || 0 }
const listaE = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' e ' + a[a.length - 1] : a[0] || ''
async function vigiar() {
  clearTimeout(ativT)
  if (DEMO) return
  let a; try { a = await api('/api/atividade') } catch { ativT = setTimeout(vigiar, 15000); return }
  const aqui = atual?.dataset.scene
  // criações que terminaram
  for (const r of a.rotinas) {
    const k = r.id + ':' + r.inicio, antes = ATIV_VISTO.runs[k]
    if (!ativPrimeira && antes === 'rodando' && r.status !== 'rodando') {
      if (r.status === 'concluída') { Som.liga(); avisoFixo({ tipo: 'ok', titulo: `Pronto: ${r.titulo}`, texto: 'O post está em Revisar esperando você.', acao: { rotulo: 'Revisar agora', fn: () => { FILTRO = 'pendente'; foco = 0; voltarPara = null; cena('fila') } } }) }
      else { Som.erro(); avisoFixo({ tipo: 'erro', titulo: `${r.titulo} não deu certo`, texto: 'Veja o que a IA fez e tente de novo.', acao: { rotulo: 'Ver em Criar', fn: () => { voltarPara = null; cena('rotinas') } } }) }
      if (aqui === 'fila') carregarFila(); if (aqui === 'rotinas') carregarRotinas()
    }
    ATIV_VISTO.runs[k] = r.status
  }
  // análise do perfil (a tela Perfil e o fim da entrada já acompanham a deles)
  const an = a.analise?.estado
  if (!ativPrimeira && ATIV_VISTO.analise === 'rodando' && an && an !== 'rodando' && !['perfil', 'estrategia'].includes(aqui)) {
    an === 'pronto' ? avisoFixo({ tipo: 'ok', titulo: 'A sua IA terminou de ler o seu perfil', texto: 'Veja as sugestões e aplique o que fizer sentido.', acao: { rotulo: 'Ver sugestões', fn: () => { voltarPara = null; cena('perfil') } } })
      : avisoFixo({ tipo: 'erro', titulo: 'A análise do perfil não deu certo', texto: a.analise.erro || 'Tente de novo em Estratégia.', acao: { rotulo: 'Abrir Estratégia', fn: () => { voltarPara = null; cena('perfil') } } })
  }
  ATIV_VISTO.analise = an || null
  // busca da Rede
  const rd = a.rede?.estado
  if (!ativPrimeira && ATIV_VISTO.rede === 'rodando' && rd && rd !== 'rodando' && aqui !== 'rede') {
    rd === 'pronto' ? avisoFixo({ tipo: 'ok', titulo: 'Sugestões da Rede prontas', texto: 'Conexões e vagas para a sua área.', acao: { rotulo: 'Ver', fn: () => { voltarPara = null; cena('rede') } } })
      : avisoFixo({ tipo: 'erro', titulo: 'A busca da Rede não deu certo', texto: a.rede.erro || 'Tente de novo.', acao: { rotulo: 'Abrir Rede', fn: () => { voltarPara = null; cena('rede') } } })
  }
  ATIV_VISTO.rede = rd || null
  // avisos da agenda e das repetições (o app pode ter reaberto: a numeração recomeça)
  const maior = Math.max(0, ...a.avisos.map(x => x.n))
  if (maior < ATIV_VISTO.aviso) ATIV_VISTO.aviso = 0
  for (const x of a.avisos.filter(x => x.n > ATIV_VISTO.aviso).reverse()) {
    avisoFixo({ tipo: x.ok ? 'ok' : 'erro', titulo: x.titulo, texto: x.texto, acao: x.chave && !x.ok ? { rotulo: 'Ver o post', fn: () => abrirNaFila(x.chave) } : x.link ? { rotulo: 'Ver no LinkedIn', fn: () => abrirFora(x.link) } : null })
  }
  ATIV_VISTO.aviso = Math.max(ATIV_VISTO.aviso, maior); store.set('aviso-visto', ATIV_VISTO.aviso)
  ATIV = a; ativPrimeira = false; desenharAtiv()
  if (aqui === 'fila') detalhe(); if (aqui === 'calendario') desenharCalAvisos()
  const algo = a.rotinas.some(r => r.status === 'rodando') || an === 'rodando' || rd === 'rodando'
  ativT = setTimeout(vigiar, algo ? 4000 : 15000)
}
function desenharAtiv() {
  const el = $('#ativ'); if (!el) return
  const n = ATIV.rotinas.filter(r => r.status === 'rodando').length, partes = []
  if (n) partes.push(n === 1 ? 'criando 1 post' : `criando ${n} posts`)
  if (ATIV.analise?.estado === 'rodando') partes.push('lendo o seu perfil')
  if (ATIV.rede?.estado === 'rodando') partes.push(ATIV.rede.tipo === 'vagas' ? 'buscando vagas' : ATIV.rede.tipo === 'conexoes' ? 'buscando conexões' : 'buscando conexões e vagas')
  el.hidden = !partes.length
  el.dataset.ir = n ? 'rotinas' : ATIV.analise?.estado === 'rodando' ? 'perfil' : 'rede'
  $('[data-ativ-t]', el).textContent = `A sua IA está ${listaE(partes)}`
  el.title = 'Ver o andamento'
}
$('#ativ')?.addEventListener('click', e => { const ir = e.currentTarget.dataset.ir; if (ONB.includes(atual?.dataset.scene)) return; voltarPara = null; cena(ir) })
// avisos da agenda na Agenda
function desenharCalAvisos() {
  const box = $('[data-cal-avisos]'); if (!box) return
  box.innerHTML = ATIV.avisos.slice(0, 3).map(a => `<div class="cr-aviso ${a.ok ? 'ok' : 'bad'}"><span class="dot"></span><span><b>${esc(a.titulo)}</b> · ${esc(a.texto)}</span>${a.chave && !a.ok ? `<button class="link" type="button" data-cal-fila="${esc(a.chave)}">Ver o post</button>` : a.link ? `<a class="link" href="${esc(urlOk(a.link))}" target="_blank" rel="noopener">Ver no LinkedIn ↗</a>` : ''}</div>`).join('')
}

// ---------------------------------------------------------------- fim da entrada: a sua estratégia
// a análise começa quando a IA termina de sincronizar; aqui a pessoa vê o resultado e escolhe o que usar
let ESTR = null, estT = null
const EST_CAMPOS = [['area', 'Área de atuação'], ['publico', 'Para quem você escreve'], ['objetivo', 'Objetivo no LinkedIn'], ['tom', 'Tom de voz']]
async function entrarEstrategia() {
  clearTimeout(estT)
  let d; try { d = await api('/api/perfil') } catch (e) { return falha(e) }
  const marcados = ESTR?.marcados
  ESTR = { perfil: d.perfil, estado: d.analise, agente: d.agente, marcados: marcados || null, usada: ESTR?.usada || false }
  desenharEstrategia()
  if (d.analise?.estado === 'rodando') estT = setTimeout(() => atual?.dataset.scene === 'estrategia' && entrarEstrategia(), 3000)
}
function aplicarAnalise(P, a, chaves) {   // as mesmas regras do botão "Aplicar" em Perfil
  for (const k of chaves) {
    if (['area', 'publico', 'objetivo', 'tom'].includes(k) && a[k]) P[k] = a[k]
    if (k === 'temas' && a.temas?.length) P.temas = a.temas.filter(Boolean)
    if (k === 'cores') { for (const [c, v] of Object.entries(a.cores || {})) if (corOk(v) && c in P.marca.cores) P.marca.cores[c] = v; if (a.estilo_visual) P.marca.estilo = a.estilo_visual }
    if (k === 'pilares') for (const p of a.pilares || []) if (p.tema && !P.pilares.some(x => x.tema.toLowerCase() === p.tema.toLowerCase())) P.pilares.push({ tema: p.tema, por_que: p.por_que || '', ideias: (p.ideias || []).filter(Boolean) })
  }
  return P
}
function desenharEstrategia() {
  const p = ESTR.perfil, st = ESTR.estado, a = (st?.estado === 'pronto' && st.resultado) || p.analise, rodando = st?.estado === 'rodando'
  const t = $('[data-est-t]'), s = $('[data-est-s]'), corpo = $('[data-est]'), cta = $('[data-est-cta]')
  const fim = `<button class="btn accent lg" type="button" data-est-criar>Criar meu primeiro post</button><button class="btn lg" type="button" data-finish>Ir para Revisar</button>`
  if (rodando) {
    t.innerHTML = 'Lendo o seu perfil…'
    s.textContent = `A sua IA${ESTR.agente ? ` (${ESTR.agente})` : ''} está lendo as suas respostas e os seus links para sugerir a sua estratégia. Leva de 30 segundos a alguns minutos.`
    corpo.innerHTML = `<ol class="steps glass est-espera"><li class="run"><span class="ic"></span><span><b>Entendendo a sua área e o seu público</b><small>a partir das perguntas e das plataformas que você colou</small></span></li><li><span class="ic"></span><span><b>Sugerindo tom, temas e pilares de conteúdo</b><small>nada muda no seu perfil sem você escolher</small></span></li></ol>`
    cta.innerHTML = `<button class="link soft" type="button" data-finish>Continuar sem esperar (as sugestões ficam em Estratégia)</button>`
    return
  }
  if (a && (a.area || a.resumo || (a.pilares || []).length)) {
    if (!ESTR.marcados) ESTR.marcados = Object.fromEntries([...EST_CAMPOS.map(c => c[0]), 'temas', 'pilares', 'cores'].map(k => [k, true]))
    const m = ESTR.marcados, caixa = (k, rot, conteudo) => conteudo ? `<label class="est-c${m[k] ? ' on' : ''}"><input type="checkbox" data-est-k="${k}"${m[k] ? ' checked' : ''}${ESTR.usada ? ' disabled' : ''}><span class="est-h"><small>${rot}</small></span><span class="est-v">${conteudo}</span></label>` : ''
    t.innerHTML = ESTR.usada ? 'Pronto. <span class="soft">A sua IA já escreve com isso.</span>' : 'Sua estratégia.'
    s.textContent = ESTR.usada ? 'Agora é criar. A sua IA faz o primeiro post a partir de um dos seus pilares, e ele chega em Revisar para você olhar.' : 'A sua IA juntou as suas respostas e os seus links. Marque o que quer usar; dá para mudar tudo depois em Estratégia.'
    corpo.innerHTML = `${a.resumo ? `<p class="est-resumo glass">${esc(a.resumo)}</p>` : ''}<div class="est-grade">
      ${EST_CAMPOS.map(([k, rot]) => caixa(k, rot, a[k] ? esc(Array.isArray(a[k]) ? a[k].join(', ') : a[k]) : '')).join('')}
      ${caixa('temas', 'Temas', (a.temas || []).length ? esc(a.temas.join(', ')) : '')}
      ${caixa('cores', 'Cores da sua marca', Object.values(a.cores || {}).filter(corOk).length ? `<span class="est-cores">${Object.values(a.cores).filter(corOk).map(c => `<i style="background:${c}" title="${c}"></i>`).join('')}</span>${a.estilo_visual ? `<small>${esc(a.estilo_visual)}</small>` : ''}` : '')}
    </div>
    ${(a.pilares || []).length ? `<div class="est-pilares">${caixa('pilares', 'Pilares de conteúdo', `<ul>${a.pilares.map(x => `<li><b>${esc(x.tema)}</b>${x.por_que ? ` · ${esc(x.por_que)}` : ''}${(x.ideias || [])[0] ? `<small>ideia: ${esc(x.ideias[0])}</small>` : ''}</li>`).join('')}</ul>`)}</div>` : ''}`
    cta.innerHTML = ESTR.usada ? fim : `<button class="btn accent lg" type="button" data-est-usar>Usar esta estratégia</button><button class="link soft" type="button" data-finish>Pular, ver depois em Estratégia</button>`
    return
  }
  // sem análise (sem IA, ou deu errado): mostra o ponto de partida que a pessoa respondeu
  t.innerHTML = 'Seu ponto de partida.'
  s.textContent = st?.estado === 'falhou' ? `A análise não deu certo agora (${st.erro || 'erro'}). Dá para pedir de novo em Estratégia; a sua IA já usa o que você respondeu.` : 'Isto é o que você contou. Quando quiser, peça à sua IA para completar a estratégia em Perfil.'
  const linhas = [...EST_CAMPOS, ['nivel', 'Momento da carreira'], ['frequencia', 'Frequência']].filter(([k]) => p[k]).map(([k, rot]) => `<div class="est-c on fixo"><span class="est-h"><small>${rot}</small></span><span class="est-v">${esc(p[k])}</span></div>`).join('')
  corpo.innerHTML = linhas ? `<div class="est-grade">${linhas}</div>` : '<p class="fine">Você pulou as perguntas. Tudo bem: dá para preencher em Estratégia.</p>'
  cta.innerHTML = fim
}
$('[data-scene=estrategia]')?.addEventListener('change', e => { const c = e.target.closest('[data-est-k]'); if (!c) return; ESTR.marcados[c.dataset.estK] = c.checked; Som.tique(); desenharEstrategia() })
$('[data-scene=estrategia]')?.addEventListener('click', async e => {
  if (e.target.closest('[data-est-usar]')) {
    const st = ESTR.estado, a = (st?.estado === 'pronto' && st.resultado) || ESTR.perfil.analise
    const chaves = Object.entries(ESTR.marcados || {}).filter(([, v]) => v).map(([k]) => k)
    if (!chaves.length) return pill('Marque pelo menos um item', 'Ou pule e veja depois em Estratégia.', 'var(--amber)')
    try {
      const P = aplicarAnalise(JSON.parse(JSON.stringify(ESTR.perfil)), a, chaves)
      ESTR.perfil = await api('/api/perfil/salvar', { id: P.id, perfil: P }); ESTR.usada = true
      Som.publica(); pill('Estratégia salva', 'A sua IA já escreve com ela.', 'var(--green)'); desenharEstrategia()
    } catch (err) { falha(err) }
    return
  }
  if (e.target.closest('[data-est-criar]')) {
    store.set('onboarded', '1'); voltarPara = null
    if (!ST) await status()
    if (!ST?.agente?.conectado) return cena('rotinas')
    try {
      const mod = (await api('/api/runs')).rotinas, id = recomendados(ESTR.perfil, mod).ids[0]
      if (!id) return cena('rotinas')
      await api('/api/run', { id }); Som.liga()
      avisoFixo({ tipo: 'info', titulo: 'A sua IA começou o seu primeiro post', texto: `Modelo "${(mod.find(m => m.id === id) || {}).titulo || id}". Leva de 2 a 10 minutos; o aviso aparece quando ficar pronto.` })
      vigiar(); cena('inicio'); tourSeNovo()
    } catch (err) { falha(err); cena('rotinas') }
  }
})

// ---------------------------------------------------------------- início
setTimeout(() => carregarAtualizacao('sim'), DEMO ? 4000 : 8000)
setInterval(() => carregarAtualizacao(), 30 * 60000)
if (DEMO) setTimeout(() => pill('Demonstração', 'Logins simulados: nada é conectado nem publicado de verdade.', 'var(--violet)'), 1200)
if (new URLSearchParams(location.search).has('captura')) document.documentElement.classList.add('static')
const pedida = new URLSearchParams(location.search).get('tela')   // ?tela=fila abre direto numa cena (útil para capturas e atalhos)
if (pedida && ($(`.scene[data-scene="${pedida}"]`) || pedida === 'conexoes' || pedida === 'vagas')) cena(pedida, { som: false })
else {
  // quem já tem o LinkedIn e a IA prontos não passa pela entrada de novo (mesmo se as preferências do navegador sumiram)
  const abrirApp = () => { cena('inicio', { som: false }); setInterval(() => { const a = atual?.dataset.scene; a === 'fila' ? carregarFila() : a === 'calendario' ? carregarCalendario() : a === 'inicio' && carregarInicio() }, 60000) }
  if (store.get('onboarded') === '1') abrirApp()
  else status().then(s => { if (!DEMO && s && (s.linkedin?.contas || []).length && s.agente?.sincronizado) { store.set('onboarded', '1'); abrirApp() } else cena('ola', { som: false }) })
}
vigiar()
marcarAreas()
