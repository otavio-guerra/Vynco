'use strict'
// Vynco: Revisar, Mídias, editor de posts, estúdio de imagens e Estratégia.
// Carregado depois de app.js (index.html); usa as funções e o estado globais de lá.

// ---------------------------------------------------------------- fila
let FILA = [], FILTRO = 'pendente', foco = 0, verMais = false, AG_AB = false, APROVOU = null
const localISO = d => `${ymd(d)}T${hhmm(d)}`
const proximaHora = () => { const [h, m] = store.get('hora', '09:00').split(':').map(Number), d = new Date(); d.setHours(h, m, 0, 0); if (d < new Date()) d.setDate(d.getDate() + 1); return d }
const TIPO = { dailyui: 'Daily UI', noticias: 'Carrossel', series: 'Série', avulsos: 'Avulso' }
const FMT_TXT = { imagem: 'Imagem', gif: 'GIF', carrossel: 'Carrossel', documento: 'Documento', video: 'Vídeo', multi: 'Várias imagens', texto: 'Só texto', artigo: 'Artigo' }
const LIMITE = 3000   // caracteres do texto de um post no LinkedIn
const dominio = u => { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return '' } }
const estado = i => i.published ? 'pub' : i.rascunho ? 'draft' : i.agendado && i.approved ? 'sched' : i.approved ? 'ok' : ''
const quandoCurto = q => new Date(q).toLocaleString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const estadoTxt = i => i.published ? 'no ar' : i.rascunho ? 'rascunho' : i.aprovacaoAviso ? 'aprove de novo' : i.agendado ? (i.approved ? 'sai ' : 'agendado, falta aprovar · ') + quandoCurto(i.agendado) : i.approved ? 'aprovado' : 'esperando você'
const CONTA = { pendente: i => !i.published && !i.approved && !i.rascunho, pronto: i => !i.published && i.approved && !i.rascunho, publicado: i => !!i.published, rascunho: i => !i.published && !!i.rascunho, todos: () => true }
const FILTROS_REVISAR = ['pendente', 'pronto', 'rascunho']
const visiveis = () => FILA.filter(CONTA[FILTRO])
async function carregarFila() {
  if (!FILTROS_REVISAR.includes(FILTRO)) FILTRO = 'pendente'   // o que já foi ao ar mora na Agenda
  try { [FILA] = await Promise.all([api('/api/queue'), ST ? null : status()]) } catch (e) { return falha(e) }
  if (APROVOU) { const k = visiveis().findIndex(x => chaveIt(x) === APROVOU); if (k >= 0) foco = k }   // o post recém-aprovado fica selecionado
  desenharFila(); atualizarHumor(); contarFila()
}
function atualizarHumor() {
  if (!['fila', 'rotinas', 'ajustes', 'biblioteca', 'editor', 'perfil', 'rede', 'calendario'].includes(atual?.dataset.scene)) return
  humor(FILA.some(CONTA.pendente) ? 'waiting' : FILA.some(CONTA.pronto) ? 'live' : 'neutral')
}
const capa = i => i.formato === 'texto' ? wire('texto', { texto: (i.caption || '').slice(0, 160) })
  : i.cover ? `<img src="${arquivo(i.cover)}" alt="" loading="lazy">${i.formato === 'multi' ? `<span class="wf-badge">${(i.arquivos || []).length} IMAGENS</span>` : i.formato === 'artigo' ? `<span class="wf-badge">LINK</span>` : ''}`
  : i.formato === 'video' && i.file && !DEMO ? `<video src="${arquivo(i.file)}" muted preload="metadata"></video>` : wire(i.formato || 'imagem', { paginas: i.paginas, n: (i.arquivos || []).length || undefined })
// mídia da prévia no feed: como o LinkedIn mostra cada formato
function midiaFeed(i) {
  if (i.formato === 'texto') return ''
  if (i.formato === 'multi') {
    const a = i.arquivos || [], mostra = a.slice(0, 4)
    if (!a.length) return `<div class="fp-media">${wire('multi')}</div>`
    return `<div class="fp-media fp-multi n${Math.min(mostra.length, 4)}">${mostra.map((f, k) => `<span><img src="${arquivo(f)}" alt="">${k === 3 && a.length > 4 ? `<b>+${a.length - 4}</b>` : ''}</span>`).join('')}</div>`
  }
  if (i.formato === 'artigo') {
    const art = i.artigo || {}
    return `<div class="fp-media fp-link">${i.cover ? `<img src="${arquivo(i.cover)}" alt="">` : wire('artigo')}<span><b>${esc(art.titulo || 'Título do artigo')}</b><small>${esc(dominio(art.url) || 'site.com')}</small></span></div>`
  }
  const media = i.formato === 'video' && i.file && !DEMO ? `<video src="${arquivo(i.file)}" controls preload="metadata"></video>` : i.formato === 'gif' && i.file && !DEMO ? `<img src="${arquivo(i.file)}" alt="Prévia de ${esc(i.title)}">` : i.cover ? `<img src="${arquivo(i.cover)}" alt="Prévia de ${esc(i.title)}">` : wire(i.formato || 'imagem', { paginas: i.paginas })
  return `<div class="fp-media">${media}${['carrossel', 'documento'].includes(i.formato) ? `<span class="fp-pages">${i.paginas ? i.paginas + ' páginas' : 'Documento'}</span>` : ''}</div>`
}
// legenda como o LinkedIn mostra: hashtags e links em destaque (o texto já vem escapado)
const legendaFeed = t => esc(t).replace(/(^|[\s(])(#[\p{L}\p{N}_]+)/gu, '$1<span class="fp-tag">$2</span>').replace(/(https?:\/\/[^\s<]+)/g, '<span class="fp-tag">$1</span>')
// o cartão do post como aparece no feed (usado na fila e no editor)
function cartaoFeed(i, { aberto = false, quandoTxt = 'agora' } = {}) {
  const l = ST?.linkedin || {}, nome = l.name || 'Você'
  const longa = (i.caption || '').length > 180 || (i.caption || '').split('\n').length > 3
  return `<article class="fp">
      <header class="fp-head"><span class="avatar" style="${l.foto ? `background-image:url('${esc(l.foto)}');color:transparent` : ''}">${inicial(nome)}</span><span><b>${esc(nome)}</b><small>${quandoTxt} · Público</small></span></header>
      <div class="fp-cap${longa && !aberto ? ' clamp' : ''}">${i.caption ? legendaFeed(i.caption) : 'Sem legenda.'}</div>${longa ? `<div class="fp-more"><button class="link" data-q="mais">${aberto ? 'ver menos' : 'ver mais'}</button></div>` : ''}
      ${midiaFeed(i)}
      <div class="fp-foot"><span><svg viewBox="0 0 16 16"><path d="M5 7v6H3V7zm2 6V7l3-5c1 0 1.6.8 1.4 1.8L11 6h2.4c.9 0 1.5.8 1.3 1.7l-1 4.5c-.2.5-.6.8-1.2.8z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>Gostei</span><span><svg viewBox="0 0 16 16"><path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>Comentar</span><span><svg viewBox="0 0 16 16"><path d="M9.5 3 13 6.5 9.5 10M13 6.5H7a4 4 0 0 0-4 4V13" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>Compartilhar</span><span><svg viewBox="0 0 16 16"><path d="M14 2 7 9M14 2l-4.5 12L7 9 2 6.5z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>Enviar</span></div>
    </article>`
}
function desenharFila() {
  const v = visiveis(), pend = FILA.filter(CONTA.pendente).length, prontos = FILA.filter(CONTA.pronto).length
  $$('[data-filter] button').forEach(b => { b.classList.toggle('on', b.dataset.v === FILTRO); const n = FILA.filter(CONTA[b.dataset.v]).length; b.innerHTML = `${b.textContent.replace(/\d+$/, '').trim()}<span class="n">${n}</span>` })
  const MODO = {
    pendente: { t: pend ? `${pend} ${pend === 1 ? 'post esperando' : 'posts esperando'} você.` : 'Nada esperando você.', d: 'Leia a prévia e aprove. Nada vai ao ar sem isso. <kbd class="sm">A</kbd> aprova, <kbd class="sm">P</kbd> publica.' },
    pronto: { t: prontos ? `${prontos} ${prontos === 1 ? 'post aprovado' : 'posts aprovados'}.` : 'Nenhum aprovado ainda.', d: 'Prontos para sair: publique agora (<kbd class="sm">P</kbd>) ou escolha o dia e a hora. Mudou algo? Desfaça a aprovação.' },
    rascunho: { t: FILA.filter(CONTA.rascunho).length ? 'Rascunhos.' : 'Nenhum rascunho.', d: 'Posts que você começou e ainda não enviou para aprovação. Termine no editor e envie quando quiser.' },
  }[FILTRO]
  $('[data-scene=fila]').dataset.modo = FILTRO
  if (MODO) { $('[data-fila-title]').textContent = MODO.t; $('[data-fila-sub]').innerHTML = MODO.d }
  foco = Math.max(0, Math.min(foco, v.length - 1))
  $('[data-strip]').innerHTML = v.length ? v.map((i, n) => `<button class="post${n === foco ? ' focus' : ''}" data-n="${n}" aria-pressed="${n === foco}">
    <div class="shot">${capa(i)}</div>
    <footer><span class="state ${estado(i)}"></span><span><b>${esc(i.title)}</b><small>${FMT_TXT[i.formato] || TIPO[i.kind]} · ${estadoTxt(i)}</small></span></footer>
    ${i.formato !== 'texto' && i.caption ? `<p class="resumo">${esc(i.caption.split('\n').filter(l => l.trim())[0] || '')}</p>` : ''}</button>`).join('')
    : `<div class="empty"><div class="wf-row">${wire('imagem')}${wire('carrossel')}${wire('video')}</div><h3>${FILTRO === 'pendente' ? 'Nada esperando você.' : 'Nada por aqui.'}</h3><p>Quando a sua IA terminar uma peça, ela aparece aqui para você olhar antes de ir ao ar.</p><div class="cta small"><button class="btn sm accent" data-view="rotinas">Escolher um modelo de post</button><button class="btn sm" data-novo-post>Escrever um post</button></div></div>`
  detalhe()
}
function detalhe() {
  const i = visiveis()[foco], d = $('[data-detail]')
  if (!i) { d.hidden = true; return } d.hidden = false
  const l = ST?.linkedin || {}, nome = l.name || 'Você'
  const chars = i.caracteres ?? (i.caption || '').trim().length, passou = chars > LIMITE
  const editar = i.kind === 'avulsos' && i.pasta && !i.published ? `<button class="btn" data-q="editar">Editar</button>` : ''
  const acoes = i.published ? `<a class="btn" href="${esc(urlOk(i.published.link))}" target="_blank" rel="noopener">Ver no LinkedIn</a>`
    : i.rascunho ? `<button class="btn accent" data-q="enviar">Enviar para aprovação</button>${editar}<button class="link soft" data-q="excluir">Excluir</button>`
    : [editar, !i.hasFile ? `<button class="btn" data-q="export">Exportar</button>` : '',
       `<button class="btn${i.approved ? '' : ' accent'}" data-q="toggle">${i.approved ? 'Desfazer aprovação' : 'Aprovar'} <kbd>A</kbd></button>`,
       i.approved && i.hasFile ? `<button class="btn good" data-q="publish"${passou ? ' disabled' : ''}>Publicar agora <kbd>P</kbd></button>` : '',
       !i.published ? `<button class="btn" data-q="agendar" aria-expanded="${AG_AB}">${i.agendado ? 'Mudar horário' : 'Agendar'}</button>` : ''].join('')
  const avisoAg = ATIV.avisos.find(a => a.chave === chaveIt(i) && !a.ok)
  const alerta = !i.published && i.aprovacaoAviso ? `<div class="fp-alerta"><b>${i.aprovacaoAviso === 'antiga' ? 'Aprove de novo, com um clique' : 'Este post mudou depois que você aprovou'}</b><small>${i.aprovacaoAviso === 'antiga' ? 'A aprovação é de antes da atualização de segurança, que agora confere o texto e os arquivos de cada post.' : 'O texto ou um arquivo é diferente do que você aprovou. Olhe a prévia de novo antes de aprovar.'}</small></div>` : avisoAg && !i.published ? `<div class="fp-alerta"><b>${esc(avisoAg.texto)}</b><small>${new Date(avisoAg.quando).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</small></div>` : ''
  d.innerHTML = `${alerta}${APROVOU === chaveIt(i) && i.approved && !i.published && !i.agendado ? (() => { const q = proximoLivre(); return `<div class="fp-depois"><b>Aprovado. E agora?</b><div class="fp-depois-a"><button class="btn accent" data-q="ag-sugestao" data-quando="${q.toISOString()}">Agendar para ${esc(quandoCurto(q))}</button><button class="btn good" data-q="publish"${passou ? ' disabled' : ''}>Publicar agora</button><button class="link" data-q="agendar">Outro horário</button></div><small>Sugestão: o próximo dia útil livre, no horário que você costuma usar.</small></div>` })() : ''}<div class="fp-label"><span>Prévia no feed</span><span>${TIPO[i.kind]} · ${FMT_TXT[i.formato] || ''}</span></div>
    ${cartaoFeed(i, { aberto: verMais, quandoTxt: i.published ? 'publicado ' + quando(Date.parse(i.published.quando)) : 'agora' })}
    ${i.agendado && !i.published ? `<div class="fp-ag${i.approved ? '' : ' warn'}"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3" width="12" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg><span>${i.approved ? 'Sai sozinho' : 'Agendado, mas só sai se você aprovar'} · <b>${quandoCurto(i.agendado)}</b></span></div>` : ''}
    <div class="fp-actions">${acoes}${i.file && (!i.pasta || ST?.desktop) ? `<a class="link" href="${arquivo(i.file)}" target="_blank" rel="noopener">${i.pasta ? 'Abrir a pasta' : 'Abrir o arquivo'}</a>` : ''}</div>
    ${AG_AB && !i.published && !i.rascunho ? `<div class="fp-agform">${(() => { const q = i.agendado ? new Date(i.agendado) : proximoLivre(); return `<label><span>Dia</span><input type="date" data-ag-dia value="${ymd(q)}" min="${hoje0()}"></label><label><span>Hora</span><input type="time" data-ag-hora value="${hhmm(q)}"></label>` })()}<button class="btn sm accent" data-q="ag-salvar">${i.approved ? 'Agendar' : 'Aprovar e agendar'}</button>${i.agendado ? '<button class="link soft" data-q="ag-tirar">Tirar da agenda</button>' : ''}<p class="fine">Sugestão: o próximo dia útil livre, no horário que você costuma usar. O Vynco publica no horário enquanto estiver aberto; se estiver fechado, publica assim que você abrir. <button class="link" data-q="ag-ver">Ver na Agenda</button></p></div>` : ''}
    <p class="fp-note${passou ? ' bad' : ''}">${passou ? `O texto tem ${chars.toLocaleString('pt-BR')} caracteres: o LinkedIn aceita até ${LIMITE.toLocaleString('pt-BR')}. Encurte a legenda para publicar.` : `${chars.toLocaleString('pt-BR')} de ${LIMITE.toLocaleString('pt-BR')} caracteres`}${!i.published && !l.connected ? ' · Conecte o LinkedIn em Ajustes para publicar.' : l.connected && !i.published ? ` · sai como ${esc(l.name || '')}` : ''}</p>`
}
async function acao(q) {
  const i = visiveis()[foco]; if (!i) return
  if (q === 'mais') { verMais = !verMais; return detalhe() }
  if (q === 'editar') return abrirEditor({ id: i.id })
  if (q === 'agendar') { AG_AB = !AG_AB; Som.tique(); return detalhe() }
  if (q === 'ag-sugestao') { const b = $('[data-q=ag-sugestao]'), d = new Date(b.dataset.quando); APROVOU = null; return agendarItem(chaveIt(i), ymd(d), hhmm(d)) }
  if (q === 'ag-salvar') { const dia = $('[data-ag-dia]').value, hora = $('[data-ag-hora]').value, v = dia && hora ? dia + 'T' + hora : ''; if (!v) return pill('Escolha o dia e a hora', '', 'var(--amber)'); AG_AB = false; return agendarItem(chaveIt(i), v.slice(0, 10), v.slice(11, 16)) }
  if (q === 'ag-ver') { const d = $('[data-ag-dia]').value || hoje0(), n = new Date(d + 'T12:00'); CAL.dia = d; CAL.ano = n.getFullYear(); CAL.mes = n.getMonth(); AG_ABA = 'mes'; AG_AB = false; voltarPara = null; return cena('calendario') }
  if (q === 'ag-tirar') { AG_AB = false; return tirarDaAgenda(chaveIt(i)) }
  const item = { kind: i.kind, id: i.id }
  try {
    if (q === 'enviar') { await api('/api/post/enviar', { id: i.id }); Som.liga(); pill('Enviado para aprovação', i.title, 'var(--amber)'); FILTRO = 'pendente' }
    if (q === 'excluir') { if (!(await confirmar('Excluir este rascunho?', `"${i.title}" vai para a lixeira do workspace (dá para recuperar).`, 'Excluir'))) return; await api('/api/post/excluir', { id: i.id }); Som.desliga(); pill('Rascunho excluído', i.title, 'var(--amber)') }
    if (q === 'toggle' && !i.published) {
      const era = i.approved
      await api(era ? '/api/unapprove' : '/api/approve', item)
      era ? Som.desliga() : Som.liga()
      pill(era ? 'Aprovação desfeita' : 'Aprovado', i.title, era ? 'var(--amber)' : 'var(--green)')
      ring($(`[data-strip] .post[data-n="${foco}"] .state`))
      APROVOU = era ? null : chaveIt(i)   // mostra o "E agora?" no lugar dos botões
      if (!era) { FILTRO = 'pronto'; foco = 0 }
    }
    if (q === 'export') { pill('Exportando…', i.title); await api('/api/export', item); Som.tique(); pill('Exportado', i.title, 'var(--green)') }
    if (q === 'publish') {
      if (!i.approved || i.published || !i.hasFile) return
      if ((i.caracteres ?? 0) > LIMITE) return pill('Texto longo demais', `O LinkedIn aceita até ${LIMITE} caracteres.`, 'var(--amber)')
      if (!ST?.linkedin?.connected) return pill('Conecte o LinkedIn antes', 'Ajustes → LinkedIn', 'var(--amber)')
      if (!(await confirmar('Publicar no LinkedIn agora?', `"${i.title}" vai para o seu perfil, visível para todo mundo.`, 'Publicar'))) return
      pill('Publicando…', i.formato === 'video' ? 'Vídeos levam um ou dois minutos.' : i.title, 'var(--violet)')
      const r = await api('/api/publish', item); Som.publica(); humor('live'); pill('No ar', i.title, 'var(--accent)'); window.fx?.confete(innerWidth / 2, innerHeight / 3, 120)
      if (r.link && !DEMO) abrirFora(r.link)
    }
    await carregarFila()
  } catch (e) { falha(e) }
}
$('[data-strip]').addEventListener('click', e => { const p = e.target.closest('.post'); if (!p) return; foco = +p.dataset.n; verMais = false; AG_AB = false; APROVOU = null; Som.tique(); desenharFila() })
$('[data-detail]').addEventListener('click', e => { const q = e.target.closest('[data-q]')?.dataset.q; if (q) acao(q) })
$$('[data-filter] button').forEach(b => b.addEventListener('click', () => { FILTRO = b.dataset.v; foco = 0; Som.tique(); carregarFila() }))

// ---------------------------------------------------------------- biblioteca de mídia
let BIB = [], BIB_F = 'todas', BIB_SEL = null
const ORIGEM = { envio: 'Enviado por você', dailyui: 'Daily UI', serie: 'Série', noticias: 'Carrossel de notícias' }
const TIPO_M = { imagem: 'Imagem', gif: 'GIF', video: 'Vídeo', documento: 'Documento' }
const tamanho = b => b > 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'
const filtroBib = (m, f) => f === 'todas' || (f === 'rotinas' ? ['dailyui', 'serie', 'noticias'].includes(m.origem) : f === 'gerada' ? !!m.provedor : m.tipo === f)
const origemTxt = m => m.provedor ? `Gerada com ${m.provedor}` : ORIGEM[m.origem] || m.origem
const euro = v => '€' + Number(v).toFixed(2).replace('.', ',')
function miniatura(m, { controles = false } = {}) {
  if (m.tipo === 'imagem' || m.tipo === 'gif') return `<img src="${arquivo(m.arquivo)}" alt="${esc(m.alt || '')}" loading="lazy">`
  if (m.tipo === 'video' && !DEMO && !String(m.arquivo).startsWith('blob:')) return `<video src="${arquivo(m.arquivo)}" muted preload="metadata"${controles ? ' controls' : ''}></video>`
  return wire(m.tipo === 'video' ? 'video' : 'documento')
}
async function carregarBiblioteca() {
  try { BIB = (await api('/api/midia')).itens } catch (e) { return falha(e) }
  desenharBiblioteca()
}
function desenharBiblioteca() {
  const v = BIB.filter(m => filtroBib(m, BIB_F))
  $$('[data-bib-filtro] button').forEach(b => { b.classList.toggle('on', b.dataset.v === BIB_F); const n = BIB.filter(m => filtroBib(m, b.dataset.v)).length; b.innerHTML = `${b.textContent.replace(/\d+$/, '').trim()}<span class="n">${n}</span>` })
  $('[data-bib-sub]').textContent = BIB.length ? `${BIB.length} ${BIB.length === 1 ? 'mídia' : 'mídias'}. Arraste arquivos para cá para enviar; clique numa para ver detalhes e escrever o texto alternativo.` : 'Tudo o que pode ir num post: o que você envia e o que a sua IA gera.'
  if (!v.find(m => m.arquivo === BIB_SEL)) BIB_SEL = v[0]?.arquivo || null   // a prévia acompanha o filtro (filtro vazio: sem prévia, o vazio fica no meio)
  $('[data-midias]').innerHTML = v.length ? v.map(m => `<button class="midia${m.arquivo === BIB_SEL ? ' focus' : ''}" data-m="${esc(m.arquivo)}"><div class="shot">${miniatura(m)}<span class="wf-badge">${TIPO_M[m.tipo]}</span>${m.avisos?.length ? '<span class="m-aviso" title="Tem um aviso">!</span>' : ''}</div><footer><b>${esc(m.nome)}</b><small>${esc(origemTxt(m))}${m.alt ? ' · com texto alternativo' : ''}</small></footer></button>`).join('')
    : `<div class="empty"><div class="wf-row">${wire('imagem')}${wire('gif')}${wire('video')}</div><h3>${BIB.length ? 'Nada neste filtro.' : 'A biblioteca está vazia.'}</h3><p>Arraste fotos, GIFs, vídeos ou PDFs para cá, ou use "Enviar arquivos". O que as rotinas gerarem também aparece aqui.</p></div>`
  detalheMidia()
}
function detalheMidia() {
  const m = BIB.find(x => x.arquivo === BIB_SEL), d = $('[data-midia-det]')
  if (!m) { d.hidden = true; return } d.hidden = false
  const visual = m.tipo === 'imagem' || m.tipo === 'gif'
  d.innerHTML = `<div class="fp-label"><span>${TIPO_M[m.tipo]}</span><span>${esc(origemTxt(m))}</span></div>
    <div class="md-prev">${miniatura(m, { controles: true })}</div>
    <div class="md-info">
      <b>${esc(m.nome)}</b>
      <small>${[m.largura ? `${m.largura} × ${m.altura}` : '', m.quadros > 1 ? `${m.quadros} quadros` : '', tamanho(m.bytes), quando(m.criado)].filter(Boolean).join(' · ')}</small>
      ${(m.avisos || []).map(a => `<p class="md-aviso">${esc(a)}</p>`).join('')}
      ${m.prompt ? `<p class="soft"><b>Prompt:</b> ${esc(m.prompt)}</p>` : ''}
      ${m.mae ? `<p class="soft"><b>Feita a partir de:</b> ${esc(m.mae.split('/').pop())}</p>` : ''}
      ${m.custo && m.custo.valor != null ? `<p class="soft"><b>Custo estimado:</b> ${euro(m.custo.valor)}</p>` : ''}
    </div>
    ${visual ? `<label class="ed-campo md-alt"><span>Texto alternativo <small>descreve a imagem para quem usa leitor de tela</small></span><textarea data-alt rows="3" maxlength="4086" placeholder="Ex.: Tela de cadastro com campos de nome e e-mail e um botão roxo.">${esc(m.alt || '')}</textarea></label>` : ''}
    <div class="fp-actions">
      <button class="btn accent" data-mq="usar">Usar em novo post</button>
      ${visual ? `<button class="btn" data-mq="melhorar">Melhorar</button><button class="btn" data-mq="refinar">Refinar</button>` : ''}
      ${m.tipo === 'imagem' ? '<button class="btn" data-mq="animar">Animar em vídeo</button>' : ''}${m.tipo === 'video' ? '<button class="btn" data-mq="gif">Fazer GIF</button>' : ''}
      <a class="link" href="${arquivo(m.arquivo)}" target="_blank" rel="noopener">Abrir o arquivo</a>
      ${m.apagavel ? `<button class="link soft" data-mq="excluir">Excluir</button>` : ''}
    </div>`
}
async function acaoMidia(q) {
  const m = BIB.find(x => x.arquivo === BIB_SEL); if (!m) return
  try {
    if (q === 'usar') return abrirEditor({ midias: [{ arquivo: m.arquivo, alt: m.alt || '', tipo: m.tipo, nome: m.nome }] })
    if (q === 'melhorar' || q === 'refinar') return abrirEstudio({ op: q, origem: m })
    if (q === 'animar') return abrirEstudio({ op: 'animar', origem: m })
    if (q === 'gif') return abrirEstudio({ op: 'gifvideo', origem: m })
    if (q === 'excluir') {
      if (!(await confirmar('Excluir da biblioteca?', `"${m.nome}" vai para a lixeira do workspace. Posts que já usam este arquivo continuam com a cópia deles.`, 'Excluir'))) return
      await api('/api/midia/excluir', { arquivo: m.arquivo }); Som.desliga(); pill('Excluído', m.nome, 'var(--amber)'); BIB_SEL = null; carregarBiblioteca()
    }
  } catch (e) { falha(e) }
}
async function salvarAlt(texto) {
  const m = BIB.find(x => x.arquivo === BIB_SEL); if (!m || (m.alt || '') === texto.trim()) return
  try { await api('/api/midia/alt', { arquivo: m.arquivo, alt: texto }); m.alt = texto.trim(); Som.tique(); pill('Texto alternativo salvo', m.nome, 'var(--green)'); desenharBiblioteca() } catch (e) { falha(e) }
}
$('[data-midias]').addEventListener('click', e => { const b = e.target.closest('.midia'); if (!b) return; BIB_SEL = b.dataset.m; Som.tique(); desenharBiblioteca() })
$('[data-midia-det]').addEventListener('click', e => { const q = e.target.closest('[data-mq]')?.dataset.mq; if (q) acaoMidia(q) })
$('[data-midia-det]').addEventListener('focusout', e => { if (e.target.matches('[data-alt]')) salvarAlt(e.target.value) })
$$('[data-bib-filtro] button').forEach(b => b.addEventListener('click', () => { BIB_F = b.dataset.v; Som.tique(); desenharBiblioteca() }))

// envio de arquivos (botão ou arrastar e soltar): vai para a biblioteca e, no editor, entra no post
async function enviarArquivos(lista) {
  const arqs = [...lista], feitos = []
  for (const [k, f] of arqs.entries()) {
    pill(`Enviando ${arqs.length > 1 ? `${k + 1} de ${arqs.length}` : 'arquivo'}…`, f.name, 'var(--violet)')
    try {
      if (DEMO) { const t = /\.gif$/i.test(f.name) ? 'gif' : /^image\//.test(f.type) ? 'imagem' : /^video\//.test(f.type) ? 'video' : 'documento'; const m = { arquivo: URL.createObjectURL(f), nome: f.name, tipo: t, bytes: f.size, criado: Date.now(), origem: 'envio', alt: '', avisos: [], apagavel: true }; D.midia.unshift(m); feitos.push(m); continue }
      const r = await fetch('/api/midia/upload?nome=' + encodeURIComponent(f.name), { method: 'POST', headers: { 'X-Engine-Token': TOKEN }, body: f })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(`${f.name}: ${j.erro || 'erro ' + r.status}`)
      feitos.push(j)
    } catch (e) { falha(e) }
  }
  if (feitos.length) { Som.liga(); pill(feitos.length === 1 ? 'Arquivo na biblioteca' : `${feitos.length} arquivos na biblioteca`, feitos.map(m => m.nome).join(', ').slice(0, 80), 'var(--green)') }
  return feitos
}
$('[data-enviar]').addEventListener('change', async e => { const f = await enviarArquivos(e.target.files); e.target.value = ''; if (f.length) { BIB_SEL = f[0].arquivo; carregarBiblioteca() } })
// arrastar e soltar na biblioteca e nas mídias do editor
for (const alvo of $$('.solta-alvo')) {
  alvo.addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); alvo.classList.add('solta') } })
  alvo.addEventListener('dragleave', e => { if (!alvo.contains(e.relatedTarget)) alvo.classList.remove('solta') })
  alvo.addEventListener('drop', async e => {
    e.preventDefault(); alvo.classList.remove('solta')
    const f = await enviarArquivos(e.dataTransfer.files); if (!f.length) return
    if (alvo.matches('[data-ed-midias]')) { ED.midias.push(...f.map(m => ({ arquivo: m.arquivo, alt: m.alt || '', tipo: m.tipo, nome: m.nome }))); edMudou() }
    else { BIB_SEL = f[0].arquivo; carregarBiblioteca() }
  })
}

// ---------------------------------------------------------------- editor de posts
let ED = null, ED_PEDIDO = null, edVerMais = false
const edNovo = () => ({ id: null, titulo: '', legenda: '', midias: [], artigo: null, sujo: false, salvoEm: null, aprovado: false, rascunho: true })
// abre o editor: { id } edita um post salvo; { midias } começa um post novo com essas mídias
function abrirEditor(pedido = {}) { ED_PEDIDO = pedido; voltarPara = ['fila', 'biblioteca', 'perfil', 'rotinas', 'ajustes', 'calendario', 'rede'].includes(atual?.dataset.scene) ? atual.dataset.scene : 'fila'; if (atual?.dataset.scene === 'editor') entrarEditor(); else cena('editor') }
let ED_PERFIL = null
// lembrete do perfil acima do texto: para quem, em que tom (e a ideia do pilar, quando o post nasce de uma)
function desenharLembrete() {
  const el = $('[data-ed-perfil]'), p = ED_PERFIL, partes = []
  if (p?.publico) partes.push(`<b>Para:</b> ${esc(p.publico)}`)
  if (p?.tom) partes.push(`<b>Tom:</b> ${esc(p.tom)}`)
  if (ED?.dica) partes.push(esc(ED.dica))
  el.hidden = !partes.length; el.innerHTML = partes.join(' · ')
}
async function entrarEditor() {
  const p = ED_PEDIDO || {}; ED_PEDIDO = null
  api('/api/perfil').then(r => { ED_PERFIL = r.perfil; desenharLembrete() }).catch(() => {})
  if (!p.id && !p.midias && !p.titulo && ED && ED.sujo) { desenharEditor(); return }   // voltou para o editor com algo por salvar
  ED = edNovo()
  if (p.midias) ED.midias = p.midias
  if (p.titulo) ED.titulo = p.titulo
  if (p.legenda) ED.legenda = p.legenda
  if (p.dica) ED.dica = p.dica
  if (p.id) {
    try { const r = await api('/api/post?id=' + encodeURIComponent(p.id)); Object.assign(ED, { id: r.id, titulo: r.titulo === r.id ? '' : r.titulo, legenda: r.legenda, midias: r.midias, artigo: r.artigo, aprovado: r.aprovado, rascunho: r.rascunho, salvoEm: r.atualizado }) } catch (e) { falha(e) }
  }
  edVerMais = false
  $('[data-ed-titulo]').value = ED.titulo; $('[data-ed-texto]').value = ED.legenda
  $('[data-ed-artigo]').checked = !!ED.artigo
  $('[data-art-url]').value = ED.artigo?.url || ''; $('[data-art-titulo]').value = ED.artigo?.titulo || ''; $('[data-art-desc]').value = ED.artigo?.descricao || ''
  desenharEditor(); desenharLembrete()
  setTimeout(() => (ED.legenda ? null : $('[data-ed-texto]').focus()), 350)
}
const tipoM = m => m.tipo || (/\.gif$/i.test(m.arquivo) ? 'gif' : /\.(png|jpe?g)$/i.test(m.arquivo) ? 'imagem' : /\.mp4$/i.test(m.arquivo) ? 'video' : 'documento')
function formatoEd() {
  if (ED.artigo) return 'artigo'
  const t = ED.midias.map(tipoM), imgs = t.filter(x => x === 'imagem' || x === 'gif')
  if (t.includes('video')) return 'video'
  if (t.includes('documento')) return 'documento'
  return imgs.length > 1 ? 'multi' : imgs.length === 1 ? (t[0] === 'gif' ? 'gif' : 'imagem') : 'texto'
}
// as mesmas regras do servidor (engine/posts.js), para avisar antes de salvar
function errosEd() {
  const t = ED.midias.map(tipoM), imgs = t.filter(x => x === 'imagem' || x === 'gif').length, vd = t.filter(x => x === 'video' || x === 'documento').length, e = []
  if (ED.legenda.length > LIMITE) e.push(`O texto passou do limite: ${ED.legenda.length.toLocaleString('pt-BR')} de ${LIMITE.toLocaleString('pt-BR')} caracteres.`)
  if (vd > 1 || (vd && imgs)) e.push('Vídeo e documento vão sozinhos no post: tire as outras mídias.')
  if (imgs > 20) e.push('Até 20 imagens por post.')
  if (ED.artigo && (vd || imgs > 1)) e.push('Um link leva só uma imagem, a miniatura do cartão.')
  if (ED.artigo && !/^https?:\/\/\S+$/i.test(ED.artigo.url || '')) e.push('O link precisa começar com http:// ou https://.')
  if (ED.artigo && !(ED.artigo.titulo || '').trim()) e.push('Dê um título ao cartão do link.')
  if (!ED.midias.length && !ED.artigo && !ED.legenda.trim()) e.push('Escreva um texto ou adicione uma mídia.')
  return e
}
function edMudou() { ED.sujo = true; desenharEditor() }
function desenharEditor() {
  if (!ED) return
  const f = formatoEd(), n = ED.legenda.length, erros = errosEd()
  $('[data-ed-t]').textContent = ED.id ? 'Editar post.' : 'Novo post.'
  $('[data-ed-s]').textContent = ED.aprovado ? 'Este post estava aprovado: salvar uma mudança pede a aprovação de novo.' : 'Escreva, junte as mídias e veja ao lado como fica no feed.'
  const conta = $('[data-ed-conta]'); conta.textContent = `${n.toLocaleString('pt-BR')} de ${LIMITE.toLocaleString('pt-BR')}`; conta.className = n > LIMITE ? 'bad' : n > LIMITE * 0.9 ? 'warn' : ''
  const tags = (ED.legenda.match(/#[\p{L}\p{N}_]+/gu) || []).length
  $('[data-ed-dica]').textContent = [n > 210 ? 'o feed corta depois da 3ª linha (“…ver mais”)' : '', tags ? `${tags} ${tags === 1 ? 'hashtag' : 'hashtags'}` : ''].filter(Boolean).join(' · ')
  $('[data-ed-fmt]').textContent = FMT_TXT[f]
  $('[data-ed-art]').hidden = !ED.artigo
  $('[data-ed-midias]').innerHTML = ED.midias.map((m, k) => `<div class="ed-m">
      <div class="shot">${miniatura({ ...m, tipo: tipoM(m) })}<span class="wf-badge">${k + 1}</span></div>
      <div class="ed-m-a"><button class="ic-btn" data-em="esq" data-k="${k}" title="Mover para a esquerda" ${k ? '' : 'disabled'}>‹</button><button class="ic-btn" data-em="dir" data-k="${k}" title="Mover para a direita" ${k < ED.midias.length - 1 ? '' : 'disabled'}>›</button><button class="ic-btn" data-em="tirar" data-k="${k}" title="Tirar do post">×</button></div>
      ${['imagem', 'gif'].includes(tipoM(m)) ? `<input class="ed-m-alt" data-em-alt="${k}" value="${esc(m.alt || '')}" maxlength="4086" placeholder="Texto alternativo" aria-label="Texto alternativo da mídia ${k + 1}">` : `<small class="soft">${TIPO_M[tipoM(m)]}</small>`}
    </div>`).join('') + `<div class="ed-add"><button class="ed-add-b" data-ed="gerar"><svg viewBox="0 0 16 16"><path d="M8 1.5c.4 3.4 2.6 5.6 6 6-3.4.4-5.6 2.6-6 6-.4-3.4-2.6-5.6-6-6 3.4-.4 5.6-2.6 6-6Z" fill="currentColor"/></svg>Gerar com IA</button><button class="ed-add-b" data-ed="biblioteca"><svg viewBox="0 0 16 16"><rect x="2.5" y="2.5" width="11" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M2.5 11 6 7.5l3 3 2-2 2.5 2.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>Da biblioteca</button><label class="ed-add-b"><svg viewBox="0 0 16 16"><path d="M8 11V3M4.5 6.5 8 3l3.5 3.5M3 13h10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>Enviar arquivo<input type="file" multiple hidden data-ed-enviar accept=".png,.jpg,.jpeg,.gif,.mp4,.pdf,.ppt,.pptx,.doc,.docx"></label></div>`
  const erro = $('[data-ed-erro]'); erro.hidden = !erros.length; erro.innerHTML = erros.map(esc).join('<br>')
  $('[data-ed=enviar]').disabled = !!erros.length
  $('[data-ed=enviar]').textContent = ED.rascunho ? 'Enviar para aprovação' : 'Salvar e voltar para a fila'
  $('[data-ed=salvar]').innerHTML = `${ED.rascunho ? 'Salvar rascunho' : 'Salvar'} <kbd>Ctrl S</kbd>`
  $('[data-ed-salvo]').textContent = ED.sujo ? 'Mudanças não salvas' : ED.salvoEm ? `Salvo ${new Date(ED.salvoEm).toLocaleTimeString('pt-BR', { timeStyle: 'short' })}` : ''
  // prévia ao vivo com o mesmo cartão da fila
  const imgs = ED.midias.filter(m => ['imagem', 'gif'].includes(tipoM(m)))
  const item = { kind: 'avulsos', title: ED.titulo, formato: f, caption: ED.legenda, cover: imgs[0]?.arquivo, arquivos: f === 'multi' ? imgs.map(m => m.arquivo) : undefined, file: f === 'video' ? ED.midias[0]?.arquivo : undefined, artigo: ED.artigo }
  $('[data-ed-previa]').innerHTML = `<div class="fp-label"><span>Prévia no feed</span><span>${FMT_TXT[f]}</span></div>${cartaoFeed(item, { aberto: edVerMais })}<p class="fp-note">${ST?.linkedin?.connected ? `Sai como ${esc(ST.linkedin.name)}, depois de você aprovar na fila.` : 'Conecte o LinkedIn em Ajustes para publicar.'}</p>`
}
async function salvarEd({ enviar = false, quieto = false } = {}) {
  if (!ED) return
  const erros = errosEd()
  if (enviar && erros.length) return pill('Falta ajustar', erros[0], 'var(--amber)')
  try {
    const dados = { id: ED.id, titulo: ED.titulo, legenda: ED.legenda, midias: ED.midias.map(m => ({ arquivo: m.arquivo, alt: m.alt || '' })), artigo: ED.artigo, enviar }
    const r = await api('/api/post/salvar', dados)
    Object.assign(ED, { id: r.id, sujo: false, salvoEm: r.atualizado || new Date().toISOString(), midias: r.midias || ED.midias, aprovado: false, rascunho: r.rascunho ?? !enviar })
    if (enviar) { Som.liga(); pill('Enviado para aprovação', r.titulo || '', 'var(--amber)'); FILTRO = 'pendente'; ED = null; voltarPara = null; return cena('fila') }
    if (!quieto) { Som.tique(); pill(ED.rascunho ? 'Rascunho salvo' : 'Salvo', ED.rascunho ? r.titulo || '' : 'Continua na fila, esperando a sua aprovação.', 'var(--green)') }
    desenharEditor()
  } catch (e) { falha(e) }
}
// sair do editor com algo escrito salva como rascunho, sem perguntar
function guardarAoSair() {
  if (atual?.dataset.scene !== 'editor' || !ED?.sujo || errosEd().some(x => /Escreva/.test(x))) return
  const era = ED.rascunho
  salvarEd({ quieto: true }).then(() => pill(era ? 'Rascunho salvo' : 'Mudanças salvas', era ? 'Está na fila, em Rascunhos.' : 'Continua na fila, esperando a sua aprovação.', 'var(--green)'))
}
$('[data-ed-texto]').addEventListener('input', e => { ED.legenda = e.target.value; edMudou() })
$('[data-ed-titulo]').addEventListener('input', e => { ED.titulo = e.target.value; ED.sujo = true; desenharEditor() })
$('[data-ed-artigo]').addEventListener('change', e => { ED.artigo = e.target.checked ? { url: $('[data-art-url]').value, titulo: $('[data-art-titulo]').value, descricao: $('[data-art-desc]').value } : null; edMudou(); if (e.target.checked) $('[data-art-url]').focus() })
for (const [sel, k] of [['[data-art-url]', 'url'], ['[data-art-titulo]', 'titulo'], ['[data-art-desc]', 'descricao']]) $(sel).addEventListener('input', e => { if (ED.artigo) { ED.artigo[k] = e.target.value; edMudou() } })
$('[data-ed-midias]').addEventListener('click', e => {
  const b = e.target.closest('[data-em]'); if (!b) return
  const k = +b.dataset.k, m = ED.midias
  if (b.dataset.em === 'tirar') m.splice(k, 1)
  if (b.dataset.em === 'esq' && k > 0) [m[k - 1], m[k]] = [m[k], m[k - 1]]
  if (b.dataset.em === 'dir' && k < m.length - 1) [m[k + 1], m[k]] = [m[k], m[k + 1]]
  Som.tique(); edMudou()
})
$('[data-ed-midias]').addEventListener('input', e => { if (e.target.matches('[data-em-alt]')) { ED.midias[+e.target.dataset.emAlt].alt = e.target.value; ED.sujo = true; $('[data-ed-salvo]').textContent = 'Mudanças não salvas' } })
$('[data-ed-midias]').addEventListener('change', async e => { if (!e.target.matches('[data-ed-enviar]')) return; const f = await enviarArquivos(e.target.files); ED.midias.push(...f.map(m => ({ arquivo: m.arquivo, alt: m.alt || '', tipo: m.tipo, nome: m.nome }))); edMudou() })
$('[data-ed-previa]').addEventListener('click', e => { if (e.target.closest('[data-q=mais]')) { edVerMais = !edVerMais; desenharEditor() } })

// escolher mídias da biblioteca (para o editor)
let PK = [], PK_F = 'todas', PK_SEL = []
async function abrirPicker() {
  try { PK = (await api('/api/midia')).itens } catch (e) { return falha(e) }
  PK_SEL = []; desenharPicker(); $('#picker').showModal()
}
function desenharPicker() {
  const v = PK.filter(m => PK_F === 'todas' || (PK_F === 'imagem' ? ['imagem', 'gif'].includes(m.tipo) : m.tipo === PK_F))
  $$('[data-pk-filtro] button').forEach(b => b.classList.toggle('on', b.dataset.v === PK_F))
  $('[data-pk-lista]').innerHTML = v.length ? v.map(m => { const i = PK_SEL.indexOf(m.arquivo); return `<button class="midia${i >= 0 ? ' focus' : ''}" data-pk="${esc(m.arquivo)}" aria-pressed="${i >= 0}"><div class="shot">${miniatura(m)}${i >= 0 ? `<span class="pk-n">${i + 1}</span>` : ''}</div><footer><b>${esc(m.nome)}</b><small>${TIPO_M[m.tipo]} · ${esc(origemTxt(m))}</small></footer></button>` }).join('') : '<p class="soft">Nada aqui ainda. Envie arquivos na Biblioteca ou arraste para o editor.</p>'
  $('[data-pk-n]').textContent = PK_SEL.length ? `${PK_SEL.length} ${PK_SEL.length === 1 ? 'escolhida' : 'escolhidas'} (na ordem do clique)` : 'Nada escolhido'
  $('[data-pk-ok]').disabled = !PK_SEL.length
}
$('[data-pk-lista]').addEventListener('click', e => { const b = e.target.closest('[data-pk]'); if (!b) return; const a = b.dataset.pk, i = PK_SEL.indexOf(a); i >= 0 ? PK_SEL.splice(i, 1) : PK_SEL.push(a); Som.tique(); desenharPicker() })
$$('[data-pk-filtro] button').forEach(b => b.addEventListener('click', () => { PK_F = b.dataset.v; desenharPicker() }))
$('[data-pk-ok]').addEventListener('click', () => { ED.midias.push(...PK_SEL.map(a => { const m = PK.find(x => x.arquivo === a); return { arquivo: m.arquivo, alt: m.alt || '', tipo: m.tipo, nome: m.nome } })); $('#picker').close(); Som.liga(); edMudou() })

// ---------------------------------------------------------------- estúdio de imagens (provedores em engine/imagem; hoje, Magnific)
let IMG = null, ES = null, esTimer = null, esEstimarT = null
const OP_TXT = { gerar: 'Gerar', melhorar: 'Melhorar', refinar: 'Refinar', video: 'Vídeo', animar: 'Animar', texto: 'Vídeo do texto', gifvideo: 'GIF', gifimagens: 'GIF' }
const OPS = { imagem: [['gerar', 'Gerar'], ['melhorar', 'Melhorar'], ['refinar', 'Refinar']], video: [['animar', 'Animar uma imagem'], ['texto', 'Do texto']], gif: [['gifvideo', 'De um vídeo'], ['gifimagens', 'De imagens']] }
const modoDe = op => Object.keys(OPS).find(k => OPS[k].some(([v]) => v === op)) || 'imagem'
const opServidor = op => modoDe(op) === 'video' ? 'video' : op
const tipoArq = a => /\.mp4$/i.test(a) ? 'video' : /\.gif$/i.test(a) ? 'gif' : 'imagem'
// identidade do perfil no estúdio: cores e estilo entram no texto; a primeira referência vira a referência de estilo do Mystic
const coresMarca = m => Object.values(m?.cores || {}).filter(v => /^#[0-9a-f]{6}$/i.test(v || ''))
const refMarca = m => (m?.referencias || []).find(r => BIB.some(b => b.arquivo === r))
const temMarca = m => !!(coresMarca(m).length || m?.estilo || refMarca(m))
const prov = () => IMG?.provedores?.[0]
async function abrirEstudio(o = {}) {
  try { IMG = await api('/api/imagem') } catch (e) { return falha(e) }
  if (!BIB.length) { try { BIB = (await api('/api/midia')).itens } catch { } }
  let marca = null; try { marca = (await api('/api/perfil')).perfil.marca } catch { }
  ES = { op: o.op || 'gerar', origem: o.origem || null, contexto: o.contexto || (atual?.dataset.scene === 'editor' ? 'editor' : null), jobs: [], descartados: new Set(), marca, gifImgs: [], gifs: [], gifProg: null,
    p: { prompt: o.prompt || '', aspect_ratio: 'social_post_4_5', resolution: '2k', model: 'realism', versoes: 2, scale_factor: '2x', optimized_for: 'standard', creativity: 0, resemblance: 0, hdr: 0, prompt_m: '', sharpen: 50, smart_grain: 7, ultra_detail: 30, usarMarca: !!(marca && marca.usarNoEstudio && temMarca(marca)),
      v_modelo: 'kling', v_duracao: '5', v_prop: 'widescreen_16_9', v_res: '720p', v_som: false, v_camera: false, v_negativo: '', v_cfg10: 5,
      g_inicio: 0, g_duracao: 3, g_fps: '10', g_largura: '640', g_prop: 'original', g_vel: '1', g_cores: '256', g_pontilhar: true, g_repetir: true, g_seg: '1.5', g_trans: 'suave' } }
  desenharEstudio(); $('#estudio').showModal(); estimarEs()
}
const imagensBib = () => BIB.filter(m => ['imagem', 'gif'].includes(m.tipo))
const bibDe = tipos => BIB.filter(m => tipos.includes(m.tipo))
const deslize = (k, rot, min, max, dica, suf = '') => `<label class="es-sl"><span>${rot} <b data-es-v="${k}">${ES.p[k]}${suf}</b></span><input type="range" min="${min}" max="${max}" step="1" value="${ES.p[k]}" data-es="${k}" data-suf="${suf}"><small>${dica}</small></label>`
const chipsEs = (k, rot, opcoes, dica = '') => `<div class="es-linha"><span>${rot}${dica ? ` <small>${dica}</small>` : ''}</span><div class="chips">${opcoes.map(([v, t, extra = '']) => `<button type="button" data-es-chip="${k}" data-v="${v}" class="${String(ES.p[k]) === String(v) ? 'on' : ''}" ${extra}>${t}</button>`).join('')}</div></div>`
const chaveEs = (k, rot, dica) => `<label class="ed-switch"><input type="checkbox" data-es-sw="${k}"${ES.p[k] ? ' checked' : ''}><span><b>${rot}</b><small>${dica}</small></span></label>`
const modeloVideo = () => prov().recursos.video.modelos.find(m => m.id === ES.p.v_modelo) || prov().recursos.video.modelos[0]
const quadrosGif = () => ES.op === 'gifvideo' ? GIF.contar.video({ duracao: +ES.p.g_duracao, fps: +ES.p.g_fps }) : GIF.contar.imagens(ES.gifImgs.length, { transicao: ES.p.g_trans })
function podeIr() {
  const p = prov(), op = ES.op, temTexto = ES.p.prompt.trim().length > 2
  if (op === 'gifvideo') return !!ES.origem && quadrosGif() <= 250 && !ES.gifProg
  if (op === 'gifimagens') return ES.gifImgs.length >= 2 && quadrosGif() <= 250 && !ES.gifProg
  if (!p.temChave) return false
  if (op === 'gerar' || op === 'texto') return temTexto
  if (op === 'animar') return !!ES.origem && (ES.p.v_modelo !== 'seedance' || temTexto)
  return !!ES.origem
}
function rotuloIr() {
  const op = ES.op
  if (op === 'gerar') return `Gerar ${ES.p.versoes} ${ES.p.versoes === 1 ? 'versão' : 'versões'}`
  if (op === 'melhorar') return `Melhorar ${ES.p.scale_factor}`
  if (op === 'refinar') return 'Refinar'
  if (op === 'animar' || op === 'texto') return `Criar vídeo de ${ES.p.v_duracao} s`
  return ES.gifProg ? 'Fazendo o GIF…' : 'Fazer o GIF'
}
function desenharEstudio() {
  const p = prov(), r = p.recursos, op = ES.op, modo = modoDe(op), local = modo === 'gif'
  $$('[data-es-modo] button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.v === modo)))
  $('[data-es-op]').innerHTML = OPS[modo].map(([v, t]) => `<button type="button" data-v="${v}" class="${v === op ? 'on' : ''}">${t}</button>`).join('')
  $('#estudio .estudio').dataset.modo = modo
  $('[data-es-chave]').hidden = local || p.temChave; $('[data-es-prov]').textContent = local ? 'feito no seu computador, sem créditos' : p.nome
  const tiposOrig = op === 'gifvideo' ? ['video'] : op === 'animar' ? ['imagem'] : ['imagem', 'gif']
  const nomeOrig = { melhorar: 'a imagem que vai ser melhorada', refinar: 'a imagem que vai ser refinada', animar: 'a imagem que vai ganhar movimento (ela vira o primeiro quadro)', gifvideo: 'o vídeo que vira GIF' }[op]
  const escolher = () => `<div class="es-orig">${ES.origem ? `<div class="es-orig-img">${tipoArq(ES.origem.arquivo) === 'video' ? `<video src="${arquivo(ES.origem.arquivo)}" muted playsinline preload="metadata"></video>` : `<img src="${arquivo(ES.origem.arquivo)}" alt="">`}<span><b>${esc(ES.origem.nome || ES.origem.arquivo.split('/').pop())}</b><small>${ES.origem.largura ? `${ES.origem.largura} × ${ES.origem.altura}` : ''}${ES.origem.duracao ? ` · ${Math.round(ES.origem.duracao)} s` : ''}</small></span><button class="link" type="button" data-es-trocar>Trocar</button></div>`
    : `<p class="soft">Escolha ${nomeOrig}:</p><div class="es-mini">${bibDe(tiposOrig).slice(0, 18).map(m => `<button type="button" data-es-orig="${esc(m.arquivo)}" title="${esc(m.nome)}">${m.tipo === 'video' ? `<video src="${arquivo(m.arquivo)}" muted preload="metadata"></video><i class="es-play">▶</i>` : `<img src="${arquivo(m.arquivo)}" alt="">`}</button>`).join('') || `<span class="soft">${op === 'gifvideo' ? 'Nenhum vídeo na biblioteca ainda. Envie um MP4 em Mídias.' : 'Nenhuma imagem na biblioteca ainda.'}</span>`}</div>`}</div>`
  let f = ''
  if (op === 'gerar') {
    f = `<label class="ed-campo"><span>O que você quer ver <small>descreva cena, estilo, luz e cores</small></span><textarea data-es="prompt" rows="4" maxlength="4000" placeholder="Ex.: um vynco pixel art num arquipélago ao entardecer, tons de roxo e menta, céu estrelado">${esc(ES.p.prompt)}</textarea></label>
      ${chipsEs('aspect_ratio', 'Proporção', r.gerar.proporcoes.slice(0, 4))}
      <div class="fields two"><label><span>Resolução</span><select data-es="resolution">${r.gerar.resolucoes.map(([v, t]) => `<option value="${v}"${ES.p.resolution === v ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
      <label><span>Estilo do modelo</span><select data-es="model">${r.gerar.modelos.map(([v, t]) => `<option value="${v}"${ES.p.model === v ? ' selected' : ''}>${t}</option>`).join('')}</select></label></div>
      ${chipsEs('versoes', 'Versões para escolher', [1, 2, 3, 4].slice(0, r.gerar.maxVersoes).map(n => [n, n]))}
      ${temMarca(ES.marca) ? `<label class="ed-switch es-marca"><input type="checkbox" data-es-marca${ES.p.usarMarca ? ' checked' : ''}><span><b>Usar a identidade do perfil</b><small><span class="pf-sw">${coresMarca(ES.marca).map(c => `<i style="background:${c}"></i>`).join('')}</span>${ES.marca.estilo ? esc(ES.marca.estilo.slice(0, 90)) : ''}${refMarca(ES.marca) ? ` · referência: ${esc(refMarca(ES.marca).split('/').pop())}` : ''}</small></span></label>` : '<p class="fine">Dica: defina cores, estilo e imagens de referência em Estratégia para as imagens saírem com a sua cara.</p>'}`
  } else if (op === 'melhorar') {
    const o = ES.origem, max = r.melhorar.maxPixels
    f = escolher() + `${chipsEs('scale_factor', 'Aumentar', r.melhorar.fatores.map(v => { const k = parseInt(v), passa = o?.largura && o.largura * k * o.altura * k > max; return [v, `${v}${o?.largura ? `<small>${o.largura * k} × ${o.altura * k}</small>` : ''}`, passa ? 'disabled title="passaria do máximo de 25,3 milhões de pixels"' : ''] }))}
      <label class="ed-campo"><span>Tipo de imagem</span><select data-es="optimized_for">${r.melhorar.otimizado.map(([v, t]) => `<option value="${v}"${ES.p.optimized_for === v ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
      ${deslize('creativity', 'Criatividade', -10, 10, 'mais alto inventa mais detalhes')}${deslize('resemblance', 'Semelhança', -10, 10, 'mais alto fica mais fiel ao original')}${deslize('hdr', 'Definição (HDR)', -10, 10, 'contraste e nitidez')}
      <label class="ed-campo"><span>Orientação <small>opcional: o que realçar</small></span><input data-es="prompt_m" maxlength="1000" value="${esc(ES.p.prompt_m)}" placeholder="Ex.: texturas de pixel art nítidas"></label>`
  } else if (op === 'refinar') {
    f = escolher() + `${deslize('sharpen', 'Nitidez', 0, 100, 'bordas mais definidas')}${deslize('ultra_detail', 'Ultra detalhe', 0, 100, 'acrescenta detalhes finos')}${deslize('smart_grain', 'Granulação', 0, 100, 'textura de foto')}`
  } else if (modo === 'video') {
    const m = modeloVideo(), comImg = op === 'animar'
    f = (comImg ? escolher() : '') + `<label class="ed-campo"><span>${comImg ? 'O que se move' : 'O que acontece no vídeo'} <small>${comImg ? (m.id === 'seedance' ? 'obrigatório no Seedance: movimento, câmera e clima' : 'opcional: descreva o movimento e a câmera') : 'cena, movimento, luz e câmera'}</small></span><textarea data-es="prompt" rows="3" maxlength="2500" placeholder="${comImg ? 'Ex.: a câmera se aproxima devagar, as luzes da cidade acendem, nuvens passando' : 'Ex.: uma mesa de trabalho com um notebook mostrando gráficos, luz da manhã, câmera deslizando para a direita'}">${esc(ES.p.prompt)}</textarea></label>
      <div class="es-linha"><span>Modelo</span><div class="es-cards">${r.video.modelos.map(x => `<button type="button" data-es-chip="v_modelo" data-v="${x.id}" class="es-card${x.id === m.id ? ' on' : ''}"><b>${x.nome}</b><small>${x.dica}</small></button>`).join('')}</div></div>
      ${chipsEs('v_duracao', 'Duração', m.duracoes.map(d => [d, d + ' s']))}
      ${!comImg || m.id === 'seedance' ? chipsEs('v_prop', 'Proporção', m.proporcoes) : '<p class="fine">A proporção segue a da imagem escolhida.</p>'}
      ${m.resolucoes ? chipsEs('v_res', 'Resolução', m.resolucoes) : ''}
      <div class="es-sws">${m.audio ? chaveEs('v_som', 'Som gerado pela IA', 'efeitos e ambiente; no LinkedIn o vídeo começa sem som') : ''}${m.camera ? chaveEs('v_camera', 'Câmera parada', 'só o que está na cena se move') : ''}</div>
      ${m.negativo ? `${deslize('v_cfg10', 'Fidelidade ao texto', 0, 10, 'mais alto segue o texto à risca; mais baixo deixa a IA criar')}<label class="ed-campo"><span>Evitar <small>opcional</small></span><input data-es="v_negativo" maxlength="2500" value="${esc(ES.p.v_negativo)}" placeholder="Ex.: texto distorcido, mãos deformadas, tremor"></label>` : ''}
      <p class="fine">O vídeo pronto vai para a biblioteca, em MP4. O LinkedIn aceita vídeos de 3 s a 30 min.</p>`
  } else if (op === 'gifvideo') {
    f = escolher() + (ES.origem ? `<video class="es-gif-prev" src="${arquivo(ES.origem.arquivo)}" muted playsinline controls preload="metadata" data-es-gif-v></video>
      <div class="fields two"><label><span>Começa em <small>segundos</small></span><input type="number" min="0" step="0.5" data-es="g_inicio" value="${ES.p.g_inicio}"></label><label><span>Ou</span><button type="button" class="btn sm" data-es-aqui>Usar o ponto do vídeo</button></label></div>` : '')
      + `${deslize('g_duracao', 'Duração', 1, 10, 'quanto do vídeo vira GIF', ' s')}
      ${chipsEs('g_fps', 'Quadros por segundo', [['8', '8'], ['10', '10'], ['12', '12'], ['15', '15']], 'mais = mais fluido e mais pesado')}
      ${chipsEs('g_vel', 'Velocidade', [['0.5', '0,5×'], ['1', '1×'], ['1.5', '1,5×'], ['2', '2×']])}
      ${chipsEs('g_prop', 'Proporção', [['original', 'Original'], ['1:1', '1:1'], ['4:5', '4:5'], ['16:9', '16:9']])}
      ${chipsEs('g_largura', 'Largura', [['480', '480'], ['640', '640'], ['800', '800'], ['1080', '1080']], 'pixels')}
      ${chipsEs('g_cores', 'Cores', [['64', '64'], ['128', '128'], ['256', '256']], 'menos cores = arquivo menor')}
      <div class="es-sws">${chaveEs('g_pontilhar', 'Pontilhado', 'suaviza degradês com poucas cores')}${chaveEs('g_repetir', 'Repetir sempre', 'o GIF volta ao começo sem parar')}</div>`
  } else if (op === 'gifimagens') {
    const imgs = bibDe(['imagem'])
    f = `<p class="soft">Escolha de 2 a 20 imagens, na ordem do clique:</p><div class="es-mini es-multi">${imgs.slice(0, 30).map(m => { const i = ES.gifImgs.indexOf(m.arquivo); return `<button type="button" data-es-gimg="${esc(m.arquivo)}" class="${i >= 0 ? 'on' : ''}" title="${esc(m.nome)}"><img src="${arquivo(m.arquivo)}" alt="">${i >= 0 ? `<span class="pk-n">${i + 1}</span>` : ''}</button>` }).join('') || '<span class="soft">Nenhuma imagem na biblioteca ainda.</span>'}</div>
      ${chipsEs('g_seg', 'Tempo em cada imagem', [['0.8', '0,8 s'], ['1.2', '1,2 s'], ['1.5', '1,5 s'], ['2', '2 s'], ['3', '3 s']])}
      ${chipsEs('g_trans', 'Passagem', [['suave', 'Suave'], ['corte', 'Corte seco']])}
      ${chipsEs('g_prop', 'Proporção', [['1:1', '1:1'], ['4:5', '4:5 · feed'], ['16:9', '16:9'], ['original', 'Da primeira imagem']])}
      ${chipsEs('g_largura', 'Largura', [['480', '480'], ['640', '640'], ['800', '800'], ['1080', '1080']], 'pixels')}
      ${chipsEs('g_cores', 'Cores', [['64', '64'], ['128', '128'], ['256', '256']])}
      <div class="es-sws">${chaveEs('g_pontilhar', 'Pontilhado', 'suaviza degradês com poucas cores')}${chaveEs('g_repetir', 'Repetir sempre', 'o GIF volta ao começo sem parar')}</div>`
  }
  $('[data-es-form]').innerHTML = f
  const ir = $('[data-es-ir]'); ir.disabled = !podeIr(); ir.textContent = rotuloIr()
  desenharResultados()
}
function paramsEs() {
  const p = ES.p
  if (ES.op === 'gerar') {
    const m = p.usarMarca && temMarca(ES.marca) ? ES.marca : null, cores = coresMarca(m), ref = refMarca(m)
    const prompt = [p.prompt.trim(), cores.length ? `Paleta de cores: ${cores.join(', ')}` : '', m?.estilo ? `Estilo: ${m.estilo}` : ''].filter(Boolean).join('. ')
    return { prompt, aspect_ratio: p.aspect_ratio, resolution: p.resolution, model: p.model, ...(ref ? { estiloArquivo: ref } : {}) }
  }
  if (modoDe(ES.op) === 'video') return { modelo: p.v_modelo, duracao: p.v_duracao, aspect_ratio: p.v_prop, resolucao: p.v_res, som: !!p.v_som, cameraFixa: !!p.v_camera, cfg: +p.v_cfg10 / 10, prompt: p.prompt.trim(), ...(p.v_negativo.trim() ? { negativo: p.v_negativo.trim() } : {}) }
  if (ES.op === 'melhorar') return { scale_factor: p.scale_factor, optimized_for: p.optimized_for, creativity: +p.creativity, resemblance: +p.resemblance, hdr: +p.hdr, ...(p.prompt_m ? { prompt: p.prompt_m } : {}) }
  return { sharpen: +p.sharpen, smart_grain: +p.smart_grain, ultra_detail: +p.ultra_detail }
}
const pedidoEs = () => ({ provedor: prov().id, op: opServidor(ES.op), params: paramsEs(), origem: ['gerar', 'texto'].includes(ES.op) ? undefined : ES.origem?.arquivo, versoes: ES.op === 'gerar' ? ES.p.versoes : 1 })
function estimarEs() {
  clearTimeout(esEstimarT)
  esEstimarT = setTimeout(async () => {
    if (modoDe(ES.op) === 'gif') {
      const n = quadrosGif(), passa = n > 250, w = +ES.p.g_largura
      $('[data-es-custo]').innerHTML = `<b>Grátis: feito aqui, sem créditos</b><small>O GIF é montado no seu computador e vai direto para a biblioteca. Nada sai daqui.</small>
        <span class="es-uso${passa ? ' passa' : ''}"><span><i style="width:${Math.min(100, n / 250 * 100)}%"></i></span>${n} de 250 quadros (o máximo do LinkedIn)${passa ? ': diminua a duração ou os quadros por segundo' : ''} · ${w} px de largura</span>`
      return
    }
    if (['melhorar', 'refinar', 'animar'].includes(ES.op) && !ES.origem) { $('[data-es-custo]').innerHTML = ''; return }
    try {
      const e = await api('/api/imagem/estimar', pedidoEs()); ES.est = e
      const u = e.uso
      $('[data-es-custo]').innerHTML = `<b>${e.total != null ? `Custo estimado: ${e.aPartir ? 'a partir de ' : ''}${euro(e.total)}` : 'Custo: não informado'}</b><small>${esc(e.nota)}</small>
        <span class="es-uso"><span><i style="width:${Math.min(100, (u.operacoes / Math.max(1, u.limiteMensal)) * 100)}%"></i></span>Este mês: ${u.operacoes} de ${u.limiteMensal} operações · ~${euro(u.gasto)} de ${euro(u.orcamentoMensal)}${u.semPreco ? ` (+${u.semPreco} sem preço publicado)` : ''}</span>`
    } catch (err) { $('[data-es-custo]').innerHTML = `<small class="bad">${esc(err.message)}</small>` }
  }, 250)
}
async function irEs() {
  if (modoDe(ES.op) === 'gif') return fazerGif()
  const p = prov(), e = ES.est, n = ES.op === 'gerar' ? ES.p.versoes : 1
  const custo = e && e.total != null ? `Custo estimado: ${e.aPartir ? 'a partir de ' : ''}${euro(e.total)}.` : 'O preço desta operação não é publicado pelo Magnific: confira no painel dele.'
  if (!(await confirmar(`Usar créditos do ${p.nome}?`, `${OP_TXT[ES.op]}: ${n} ${n === 1 ? 'operação' : 'operações'}. ${custo} O resultado fica na sua biblioteca.`, OP_TXT[ES.op]))) return
  try {
    const job = await api('/api/imagem/pedir', pedidoEs())
    ES.jobs.unshift(job.id); IMG.tarefas = [job, ...(IMG.tarefas || []).filter(j => j.id !== job.id)]
    Som.tique(); pill(ES.op === 'gerar' ? `Gerando ${n} ${n === 1 ? 'versão' : 'versões'}…` : `${OP_TXT[ES.op]}…`, modoDe(ES.op) === 'video' ? 'Vídeo leva alguns minutos. Pode fechar: ele chega na biblioteca.' : 'Leva de alguns segundos a um minuto.', 'var(--violet)')
    desenharResultados(); estimarEs(); acompanharEs()
  } catch (err) { falha(err) }
}
function acompanharEs() {
  clearTimeout(esTimer)
  esTimer = setTimeout(async () => {
    try {
      const antes = Object.fromEntries((IMG.tarefas || []).map(j => [j.id, j.estado]))
      const r = await api('/api/imagem/tarefas'); IMG.tarefas = r.tarefas
      for (const j of r.tarefas.filter(j => ES?.jobs.includes(j.id) && antes[j.id] === 'rodando' && j.estado !== 'rodando')) {
        if (j.estado === 'pronto') { Som.liga(); pill('Pronto', j.op === 'video' ? 'O vídeo já está na biblioteca.' : 'As imagens já estão na biblioteca.', 'var(--green)') } else { Som.erro(); pill('Não deu certo', (j.itens.find(i => i.erro) || {}).erro || '', 'var(--red)') }
        if (atual?.dataset.scene === 'biblioteca') carregarBiblioteca(); else api('/api/midia').then(x => (BIB = x.itens)).catch(() => {})
      }
      if ($('#estudio').open) desenharResultados()
      if (r.tarefas.some(j => j.estado === 'rodando')) acompanharEs()
    } catch { acompanharEs() }
  }, DEMO ? 700 : 2000)
}
async function fazerGif() {
  const p = ES.p, prog = (k, t) => { ES.gifProg = { k, t }; desenharResultados() }
  const o = { cores: +p.g_cores, pontilhar: !!p.g_pontilhar, repetir: !!p.g_repetir, largura: +p.g_largura, proporcao: p.g_prop, progresso: prog }
  ES.gifProg = { k: 0, t: 'Começando…' }; $('[data-es-ir]').disabled = true; $('[data-es-ir]').textContent = rotuloIr(); desenharResultados()
  try {
    const r = ES.op === 'gifvideo' ? await GIF.deVideo(arquivo(ES.origem.arquivo), { ...o, inicio: +p.g_inicio || 0, duracao: +p.g_duracao, fps: +p.g_fps, velocidade: +p.g_vel })
      : await GIF.deImagens(ES.gifImgs.map(a => arquivo(a)), { ...o, segundos: +p.g_seg, transicao: p.g_trans })
    const nome = (ES.op === 'gifvideo' ? (ES.origem.nome || 'video').replace(/\.[^.]+$/, '') : 'sequencia') + '.gif'
    let m
    if (DEMO) { m = { arquivo: URL.createObjectURL(r.blob), nome, tipo: 'gif', bytes: r.blob.size, largura: r.w, altura: r.h, quadros: r.quadros, criado: Date.now(), origem: 'envio', alt: '', avisos: [], apagavel: true }; D.midia.unshift(m) }
    else { const res = await fetch('/api/midia/upload?nome=' + encodeURIComponent(nome), { method: 'POST', headers: { 'X-Engine-Token': TOKEN }, body: r.blob }); m = await res.json(); if (!res.ok) throw new Error(m.erro || 'Não consegui guardar o GIF.') }
    ES.gifs.unshift({ arquivo: m.arquivo, info: `${r.w} × ${r.h} · ${r.quadros} quadros · ${tamanho(r.blob.size)}` })
    Som.liga(); pill('GIF pronto', `${r.quadros} quadros · ${tamanho(r.blob.size)} · já na biblioteca`, 'var(--green)')
    try { BIB = (await api('/api/midia')).itens } catch { }
    if (atual?.dataset.scene === 'biblioteca') carregarBiblioteca()
  } catch (err) { falha(err) } finally { ES.gifProg = null; if ($('#estudio').open) desenharEstudio() }
}
function desenharResultados() {
  if (ES && modoDe(ES.op) === 'gif') {
    const pr = ES.gifProg
    $('[data-es-res]').innerHTML = (pr ? `<div class="es-prog"><b>${esc(pr.t)}</b><span><i style="width:${Math.round(pr.k * 100)}%"></i></span></div>` : '')
      + (ES.gifs.length ? `<div class="es-tiles">${ES.gifs.map(g => `<div class="es-tile"><img src="${arquivo(g.arquivo)}" alt=""><small class="es-tile-i">${g.info}</small><div class="es-tile-a"><button class="btn sm accent" data-es-usar="${esc(g.arquivo)}">${ES.contexto === 'editor' ? 'Usar no post' : 'Usar em post'}</button></div></div>`).join('')}</div>`
      : pr ? '' : `<div class="es-vazio">${wire('gif')}<p>O GIF aparece aqui e vai para a biblioteca. É feito no seu computador: não gasta créditos e não sai daqui.</p></div>`)
    return
  }
  const jobs = (IMG?.tarefas || []).filter(j => ES?.jobs.includes(j.id))
  $('[data-es-res]').innerHTML = jobs.length ? jobs.map(j => `<div class="es-job"><header><span class="${j.estado === 'rodando' ? 'run' : j.estado === 'pronto' ? 'ok' : 'bad'}"><span class="ic"></span></span><b>${OP_TXT[j.op]}${j.prompt ? ` · ${esc(j.prompt.slice(0, 50))}${j.prompt.length > 50 ? '…' : ''}` : ''}</b></header>
      <div class="es-tiles">${j.itens.map(i => i.estado === 'rodando' ? '<div class="es-tile carregando"><span class="spin"></span></div>'
        : i.estado === 'falhou' ? `<div class="es-tile erro"><small>${esc(i.erro || 'falhou')}</small></div>`
        : (i.arquivos || []).filter(a => !ES.descartados.has(a)).map(a => `<div class="es-tile">${tipoArq(a) === 'video' ? `<video src="${arquivo(a)}" muted loop autoplay playsinline></video>` : `<img src="${arquivo(a)}" alt="">`}<div class="es-tile-a"><button class="btn sm accent" data-es-usar="${esc(a)}">${ES.contexto === 'editor' ? 'Usar no post' : 'Usar em post'}</button>${tipoArq(a) === 'imagem' ? `<button class="ic-btn" data-es-mais="${esc(a)}" title="Melhorar esta imagem">↑</button>` : ''}<button class="ic-btn" data-es-fora="${esc(a)}" title="Descartar (vai para a lixeira)">×</button></div></div>`).join('')).join('')}</div></div>`).join('')
    : `<div class="es-vazio">${wire(ES && modoDe(ES.op) === 'video' ? 'video' : ES?.op === 'gerar' ? 'imagem' : 'gif')}<p>${ES && modoDe(ES.op) === 'video' ? 'O vídeo aparece aqui quando ficar pronto (leva alguns minutos) e vai para a biblioteca, com o texto guardado.' : ES?.op === 'gerar' ? 'As versões aparecem aqui. Cada uma vai direto para a biblioteca, com o prompt guardado.' : 'O resultado aparece aqui e vai para a biblioteca, ligado à imagem original.'}</p></div>`
}
const atualizaEs = () => { desenharEstudio(); estimarEs() }
const origemCabe = () => { if (!ES.origem) return; const t = tipoArq(ES.origem.arquivo); const ok = ES.op === 'gifvideo' ? t === 'video' : ES.op === 'animar' ? t === 'imagem' : ['melhorar', 'refinar'].includes(ES.op) ? t !== 'video' : true; if (!ok) ES.origem = null }
$('[data-es-op]').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; ES.op = b.dataset.v; origemCabe(); Som.tique(); atualizaEs() })
$('[data-es-modo]').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b || modoDe(ES.op) === b.dataset.v) return; ES.op = OPS[b.dataset.v][0][0]; origemCabe(); Som.tique(); atualizaEs() })
$('[data-es-form]').addEventListener('click', e => {
  const c = e.target.closest('[data-es-chip]'); if (c) { const k = c.dataset.esChip; ES.p[k] = k === 'versoes' ? +c.dataset.v : c.dataset.v; if (k === 'v_modelo') { const m = modeloVideo(); if (!m.duracoes.includes(ES.p.v_duracao)) ES.p.v_duracao = m.duracoes[0]; if (!m.proporcoes.some(([v]) => v === ES.p.v_prop)) ES.p.v_prop = m.proporcoes[0][0] } Som.tique(); return atualizaEs() }
  const g = e.target.closest('[data-es-gimg]'); if (g) { const a = g.dataset.esGimg, i = ES.gifImgs.indexOf(a); i >= 0 ? ES.gifImgs.splice(i, 1) : ES.gifImgs.length < 20 && ES.gifImgs.push(a); Som.tique(); return atualizaEs() }
  if (e.target.closest('[data-es-aqui]')) { const v = $('[data-es-gif-v]'); if (v) { ES.p.g_inicio = Math.round(v.currentTime * 10) / 10; Som.tique(); return atualizaEs() } }
  const o = e.target.closest('[data-es-orig]'); if (o) { ES.origem = BIB.find(m => m.arquivo === o.dataset.esOrig); return atualizaEs() }
  if (e.target.closest('[data-es-trocar]')) { ES.origem = null; return atualizaEs() }
})
$('[data-es-form]').addEventListener('input', e => {
  const k = e.target.dataset.es; if (!k) return
  ES.p[k] = e.target.value
  const v = $(`[data-es-v="${k}"]`); if (v) v.textContent = e.target.value + (e.target.dataset.suf || '')
  const ir = $('[data-es-ir]'); ir.disabled = !podeIr(); ir.textContent = rotuloIr()
  estimarEs()
})
$('[data-es-form]').addEventListener('change', e => { if (e.target.matches('select')) { ES.p[e.target.dataset.es] = e.target.value; estimarEs() } if (e.target.matches('[data-es-marca]')) { ES.p.usarMarca = e.target.checked; Som.tique() } if (e.target.matches('[data-es-sw]')) { ES.p[e.target.dataset.esSw] = e.target.checked; Som.tique() } })
$('[data-es-ir]').addEventListener('click', irEs)
$('[data-es-res]').addEventListener('click', async e => {
  const usar = e.target.closest('[data-es-usar]'), mais = e.target.closest('[data-es-mais]'), fora = e.target.closest('[data-es-fora]')
  if (usar) {
    const m = { arquivo: usar.dataset.esUsar, alt: '', tipo: tipoArq(usar.dataset.esUsar), nome: (BIB.find(b => b.arquivo === usar.dataset.esUsar) || {}).nome || usar.dataset.esUsar.split('/').pop() }
    if (ES.contexto === 'editor' && ED) { ED.midias.push(m); edMudou(); Som.liga(); return pill('Imagem no post', 'Escreva o texto alternativo no editor.', 'var(--green)') }
    $('#estudio').close(); return abrirEditor({ midias: [m] })
  }
  if (mais) { try { BIB = (await api('/api/midia')).itens } catch { } ES.origem = BIB.find(m => m.arquivo === mais.dataset.esMais) || { arquivo: mais.dataset.esMais }; ES.op = 'melhorar'; Som.tique(); return atualizaEs() }
  if (fora) { try { await api('/api/midia/excluir', { arquivo: fora.dataset.esFora }); ES.descartados.add(fora.dataset.esFora); Som.desliga(); desenharResultados(); if (atual?.dataset.scene === 'biblioteca') carregarBiblioteca() } catch (err) { falha(err) } }
})

// Ajustes → Imagens com IA
async function carregarImgAjustes() {
  try { IMG = await api('/api/imagem') } catch { return }
  const p = prov(), u = IMG.uso
  $('[data-img-ic]').style.setProperty('--c', p.temChave ? 'var(--green)' : 'var(--faint)')
  $('[data-img-st]').textContent = p.temChave ? 'Chave conferida e guardada no cofre.' : 'Sem chave: crie uma no site do Magnific e cole abaixo.'
  $('[data-img-a]').innerHTML = p.temChave ? '<button class="link soft" type="button" data-img-remover>Remover a chave</button>' : ''
  $('[data-img-criar]').href = p.chaveUrl
  $('[data-form=img-chave] input').placeholder = p.temChave ? 'salva (cole outra para trocar)' : 'cole a chave aqui'
  const f = $('[data-form=img-config]'); if (document.activeElement !== f.limiteMensal) f.limiteMensal.value = u.limiteMensal; if (document.activeElement !== f.orcamentoMensal) f.orcamentoMensal.value = u.orcamentoMensal
  $('[data-img-uso]').textContent = `Este mês: ${u.operacoes} ${u.operacoes === 1 ? 'operação' : 'operações'}, ~${euro(u.gasto)} estimados${u.semPreco ? ` (+${u.semPreco} sem preço publicado)` : ''}.`
  $('[data-img-nota]').textContent = p.nota
}
$('[data-img-ajustes]').addEventListener('click', async e => {
  if (!e.target.closest('[data-img-remover]')) return
  if (!(await confirmar('Remover a chave do Magnific?', 'O Vynco para de conseguir gerar e melhorar imagens até você salvar outra.', 'Remover'))) return
  try { await api('/api/imagem/chave', { provedor: prov().id, chave: '' }); Som.desliga(); pill('Chave removida', '', 'var(--amber)'); carregarImgAjustes() } catch (err) { falha(err) }
})

// ---------------------------------------------------------------- perfil (quem publica, público, tom, pilares, marca)
let PF = null, PF_INFO = null, pfSujo = false, pfAnT = null
const OBJETIVOS = VC_OBJ.map(o => o[0])   // as mesmas opções da entrada
const TONS = VC_TONS.map(o => o[0])
const COR_ROT = { principal: 'Principal', secundaria: 'Secundária', acento: 'Acento', fundo: 'Fundo', texto: 'Texto' }
const COR_PADRAO = { principal: '#9246f9', secundaria: '#26eda0', acento: '#ffb547', fundo: '#1a1230', texto: '#f6f2ff' }
const caminhoPf = (o, k) => k.split('.').reduce((a, x) => a?.[x], o)
const definePf = (o, k, v) => { const ps = k.split('.'), u = ps.pop(); ps.reduce((a, x) => (a[x] ??= {}), o)[u] = v }
// contraste (WCAG): 4,5 para texto comum, 3 para títulos grandes e elementos gráficos
const lumH = h => { const n = parseInt(h.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] }
const contraste = (a, b) => { const [x, y] = [lumH(a), lumH(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
const corOk = h => /^#[0-9a-f]{6}$/i.test(h || '')
async function carregarPerfil(id) {
  desenharRitmo()
  try { PF_INFO = await api('/api/perfil' + (id ? '?id=' + encodeURIComponent(id) : '')) } catch (e) { return falha(e) }
  PF = JSON.parse(JSON.stringify(PF_INFO.perfil)); pfSujo = false
  if (!BIB.length) { try { BIB = (await api('/api/midia')).itens } catch { } }
  desenharPerfil()
  if (PF_INFO.analise?.estado === 'rodando' && PF_INFO.analise.id === PF.id) acompanharAnalise()
}
// a estratégia em uma frase: cada parte reabre a pergunta da entrada (os mesmos cartões)
function desenharResumoPf() {
  const box = $('[data-pf-resumo]'); if (!box) return
  const V = vcDoPerfil(PF, PF.nome || ST?.linkedin?.name || '')
  const parte = (passo, txt, vazio) => `<button type="button" class="vc-parte${txt ? '' : ' vazio'}" data-pf-ir="${passo}">${esc(txt || vazio)}</button>`
  box.innerHTML = `<header class="ed-box-h"><h3>Sua estratégia em uma frase</h3><span class="fine">toque numa parte para mudar</span></header><p class="pf-frase">${vcFrase(V, parte)}</p>`
}
async function desenharRitmo() {
  const box = $('[data-pf-ritmo]'); if (!box) return
  let r = null, p = null; try { [r, p] = await Promise.all([api('/api/runs'), api('/api/perfil').then(x => x.perfil)]) } catch { return }
  const ativas = (r.rotinas || []).filter(m => m.agenda?.ativo)
  box.innerHTML = `<header class="ed-box-h"><h3>Ritmo</h3><button class="link" type="button" data-view="rotinas">Ajustar em Criar</button></header>
    <p class="pf-ritmo-t"><b>${esc(p.frequencia || 'Frequência ainda não definida')}</b>${ativas.length ? ` · ${ativas.length === 1 ? 'a sua IA cria sozinha' : 'a sua IA cria sozinha'}: ${ativas.map(m => `${esc(m.titulo)} (${esc(agendaTxt(m.agenda).replace(/^Repete /, ''))})`).join('; ')}` : ' · nenhum modelo se repete sozinho ainda. Em Criar, "Repetir" faz a sua IA criar nos dias e na hora que você escolher.'}</p>`
}
function desenharPerfil() {
  if (!PF) return
  desenharResumoPf()
  $('[data-pf-sel]').innerHTML = PF_INFO.perfis.map(p => `<option value="${esc(p.id)}"${p.id === PF.id ? ' selected' : ''}>${esc(p.nome)}${p.id === PF_INFO.ativo ? ' (em uso)' : ''}</option>`).join('')
  $('[data-pf-sel]').hidden = PF_INFO.perfis.length < 2
  const conta = PF_INFO.perfis.find(p => p.id === PF.id)?.conta
  $('[data-pf-conta]').textContent = conta ? `LinkedIn: ${conta}` : PF.id === 'principal' ? 'sem conta ligada' : ''
  for (const el of $$('[data-pf]')) { if (document.activeElement === el) continue; const v = caminhoPf(PF, el.dataset.pf); el.value = Array.isArray(v) ? v.join(', ') : v || '' }
  for (const [k, ops0] of [['objetivo', OBJETIVOS], ['tom', TONS]]) {
    const salvos = (PF[k] || '').split(/,\s*/).filter(Boolean), ops = [...ops0, ...salvos.filter(v => !ops0.includes(v))]   // valores antigos continuam visíveis
    $(`[data-pf-chips="${k}"]`).innerHTML = ops.map(o => `<button type="button" data-v="${esc(o)}" class="${salvos.includes(o) ? 'on' : ''}">${esc(o)}</button>`).join('')
  }
  const c = PF.marca.cores
  $('[data-pf-cores]').innerHTML = Object.keys(COR_ROT).map(k => `<label class="pf-cor"><input type="color" data-pf-cor="${k}" value="${corOk(c[k]) ? c[k] : COR_PADRAO[k]}"${corOk(c[k]) ? '' : ' class="vazia"'}><span><b>${COR_ROT[k]}</b><input data-pf-hex="${k}" value="${esc(c[k] || '')}" maxlength="7" placeholder="—" spellcheck="false"></span></label>`).join('')
  const imgs = BIB.filter(m => ['imagem', 'gif'].includes(m.tipo)).slice(0, 24)
  $('[data-pf-refs]').innerHTML = imgs.length ? imgs.map(m => { const i = PF.marca.referencias.indexOf(m.arquivo); return `<button type="button" data-pf-ref="${esc(m.arquivo)}" class="${i >= 0 ? 'on' : ''}" title="${esc(m.nome)}"><img src="${arquivo(m.arquivo)}" alt="">${i >= 0 ? `<span class="pk-n">${i + 1}</span>` : ''}</button>` }).join('') : '<span class="soft">Envie imagens na Biblioteca para usar como referência.</span>'
  for (const el of $$('[data-pf-chk]')) el.checked = !!PF.marca[el.dataset.pfChk]
  desenharPilares(); desenharAnalise(); desenharPrevia()
  $('[data-pf-salvo]').textContent = pfSujo ? 'Mudanças não salvas' : PF.atualizado ? `Salvo ${new Date(PF.atualizado).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}` : ''
}
function pfMudou() { pfSujo = true; $('[data-pf-salvo]').textContent = 'Mudanças não salvas'; desenharPrevia() }
function desenharPrevia() {
  const c = { ...COR_PADRAO, ...Object.fromEntries(Object.entries(PF.marca.cores).filter(([, v]) => corOk(v))) }, f = PF.marca.fontes
  const checks = [['Texto sobre o fundo', contraste(c.texto, c.fundo), 4.5], ['Principal sobre o fundo', contraste(c.principal, c.fundo), 3], ['Secundária sobre o fundo', contraste(c.secundaria, c.fundo), 3]]
  const definidas = Object.values(PF.marca.cores).filter(corOk).length
  $('[data-pf-prev]').innerHTML = `<div class="fp-label"><span>Prévia da marca</span><span>${definidas ? `${definidas} de 5 cores` : 'cores padrão'}</span></div>
    <div class="pf-peca" style="--f:${c.fundo};--t:${c.texto};--p:${c.principal};--s:${c.secundaria};--a:${c.acento};--ft:'${esc(f.titulo || 'Space Grotesk')}';--fx:'${esc(f.texto || 'IBM Plex Sans')}'">
      <small>${esc((PF.area || 'sua área').toUpperCase().slice(0, 40))}</small>
      <b>${esc(PF.pilares[0]?.tema || 'Um título de post com a sua cara')}</b>
      <p>${esc(PF.publico ? `Para ${PF.publico}` : 'Texto de apoio no tom que você escolheu.').slice(0, 110)}</p>
      <span class="pf-chips"><i>${esc(PF.temas[0] || 'tema')}</i><i>${esc(PF.temas[1] || 'outro tema')}</i></span>
      <span class="pf-btn">Saiba mais</span>
    </div>
    <ul class="pf-checks">${checks.map(([t, r, min]) => `<li class="${r >= min ? 'ok' : 'warn'}"><span class="ic"></span>${t}: ${r.toFixed(1).replace('.', ',')}:1 ${r >= min ? '' : `<small>(o mínimo é ${String(min).replace('.', ',')}:1)</small>`}</li>`).join('')}</ul>
    <div class="pf-usa"><b>Como o Vynco usa isto</b><ul>
      <li>A sua IA lê o perfil antes de escrever cada post (tom, público, temas e pilares).</li>
      <li>${PF.marca.usarNoEstudio ? 'O Estúdio de imagens usa as cores, o estilo e a primeira referência.' : 'O Estúdio de imagens não usa a marca (desligado).'}</li>
      <li>${PF.marca.aplicarNoMotor ? 'As peças das rotinas saem com as suas cores e fontes.' : 'As peças das rotinas continuam com o design system atual.'}</li></ul></div>`
}
function desenharPilares() {
  $('[data-pf-pilares]').innerHTML = PF.pilares.length ? PF.pilares.map((p, k) => `<div class="pf-pilar" data-k="${k}">
      <div class="fields two"><label><span>Tema</span><input data-pl="tema" value="${esc(p.tema)}" maxlength="80"></label><label><span>Por que importa</span><input data-pl="por_que" value="${esc(p.por_que || '')}" maxlength="300"></label>
      <label class="full"><span>Ideias de post <small>uma por linha</small></span><textarea data-pl="ideias" rows="3">${esc((p.ideias || []).join('\n'))}</textarea></label></div>
      <div class="pf-ideias">${(p.ideias || []).map((i, n) => `<button class="pf-ideia" type="button" data-ideia="${k}:${n}" aria-label="Abrir no editor: ${esc(i)}">${esc(i)} <span aria-hidden="true">→</span></button>`).join('')}</div>
      <button class="link soft" type="button" data-pl-tirar="${k}">Tirar este pilar</button></div>`).join('')
    : '<p class="soft">Ainda sem pilares. Peça a análise com a IA ou adicione um à mão: 3 a 5 assuntos em que você quer ser lembrado.</p>'
}
function desenharAnalise() {
  const a = PF_INFO.analise?.id === PF.id && PF_INFO.analise.estado === 'rodando' ? null : PF.analise, rodando = PF_INFO.analise?.estado === 'rodando' && PF_INFO.analise.id === PF.id
  $('[data-pf-analisar]').disabled = rodando
  $('[data-pf-an-nota]').hidden = !!a || rodando
  if (rodando) { $('[data-pf-analise]').innerHTML = `<div class="steps glass"><li class="run"><span class="ic"></span><span><b>${esc(PF_INFO.agente ? `A sua IA (${PF_INFO.agente})` : 'A sua IA')} está lendo o seu perfil e os seus links</b><small>Leva de 30 segundos a alguns minutos.</small></span></li></div>`; return }
  if (PF_INFO.analise?.estado === 'falhou' && PF_INFO.analise.id === PF.id) { $('[data-pf-analise]').innerHTML = `<p class="ed-erro">${esc(PF_INFO.analise.erro || 'A análise não deu certo.')}</p>`; return }
  if (!a) { $('[data-pf-analise]').innerHTML = ''; return }
  const linha = (k, rot, v) => v && (!Array.isArray(v) || v.length) ? `<div class="pf-sug"><span><small>${rot}</small><b>${esc(Array.isArray(v) ? v.join(', ') : v)}</b></span><button class="link" type="button" data-aplicar="${k}">Aplicar</button></div>` : ''
  const cores = Object.entries(a.cores || {}).filter(([, v]) => corOk(v))
  $('[data-pf-analise]').innerHTML = `${a.resumo ? `<p class="pf-resumo">${esc(a.resumo)}</p>` : ''}
    ${linha('area', 'Área de atuação', a.area)}${linha('publico', 'Público', a.publico)}${linha('objetivo', 'Objetivo', a.objetivo)}${linha('tom', 'Tom de voz', a.tom)}${linha('temas', 'Temas', a.temas)}${linha('estilo', 'Estilo visual', a.estilo_visual)}
    ${cores.length ? `<div class="pf-sug"><span><small>Cores do site</small><b class="pf-sw">${cores.map(([k, v]) => `<i style="background:${v}" title="${COR_ROT[k] || k} ${v}"></i>`).join('')}</b></span><button class="link" type="button" data-aplicar="cores">Aplicar</button></div>` : ''}
    ${(a.pilares || []).length ? `<div class="pf-sug"><span><small>Pilares sugeridos</small><b>${a.pilares.map(p => esc(p.tema)).join(' · ')}</b></span><button class="link" type="button" data-aplicar="pilares">Adicionar</button></div>` : ''}
    ${(a.observacoes || []).filter(Boolean).length ? `<ul class="pf-obs">${a.observacoes.filter(Boolean).map(o => `<li>${esc(o)}</li>`).join('')}</ul>` : ''}
    <div class="cta small"><button class="btn sm" type="button" data-aplicar="tudo">Aplicar tudo</button><small class="soft">análise do ${esc(a.agente ? (({ claude: 'Claude', codex: 'ChatGPT', gemini: 'Gemini' })[a.agente] || a.agente) : 'agente')} em ${a.quando ? new Date(a.quando).toLocaleDateString('pt-BR') : ''}</small></div>`
}
function aplicarSugestao(k) {
  const a = PF.analise; if (!a) return
  const um = k => {
    if (['area', 'publico', 'objetivo', 'tom'].includes(k) && a[k]) PF[k] = a[k]
    if (k === 'temas' && a.temas?.length) PF.temas = a.temas.filter(Boolean)
    if (k === 'estilo' && a.estilo_visual) PF.marca.estilo = a.estilo_visual
    if (k === 'cores') for (const [c, v] of Object.entries(a.cores || {})) if (corOk(v) && c in PF.marca.cores) PF.marca.cores[c] = v
    if (k === 'cores' && a.fontes) { if (a.fontes.titulo) PF.marca.fontes.titulo = a.fontes.titulo; if (a.fontes.texto) PF.marca.fontes.texto = a.fontes.texto }
    if (k === 'pilares') for (const p of a.pilares || []) if (p.tema && !PF.pilares.some(x => x.tema.toLowerCase() === p.tema.toLowerCase())) PF.pilares.push({ tema: p.tema, por_que: p.por_que || '', ideias: (p.ideias || []).filter(Boolean) })
  }
  k === 'tudo' ? ['area', 'publico', 'objetivo', 'tom', 'temas', 'estilo', 'cores', 'pilares'].forEach(um) : um(k)
  pfSujo = true; Som.tique(); desenharPerfil(); pill('Aplicado', 'Confira e salve o perfil.', 'var(--green)')
}
async function salvarPerfil({ quieto = false } = {}) {
  if (!PF) return
  try { const r = await api('/api/perfil/salvar', { id: PF.id, perfil: PF }); PF = r; PF_INFO.perfil = r; pfSujo = false; if (!quieto) { Som.liga(); pill('Perfil salvo', 'A sua IA já usa no próximo post.', 'var(--green)') } desenharPerfil() } catch (e) { falha(e) }
}
async function analisarPerfil() {
  if (pfSujo) await salvarPerfil({ quieto: true })
  try { await api('/api/perfil/analisar', { id: PF.id, sobre: PF.sobre }); PF_INFO.analise = { id: PF.id, estado: 'rodando' }; humor('work'); Som.tique(); desenharAnalise(); acompanharAnalise() } catch (e) { falha(e) }
}
function acompanharAnalise() {
  clearTimeout(pfAnT)
  pfAnT = setTimeout(async () => {
    let a; try { a = await api('/api/perfil/analise') } catch { return acompanharAnalise() }
    PF_INFO.analise = a
    if (a.estado === 'rodando') { if (atual?.dataset.scene === 'perfil') desenharAnalise(); return acompanharAnalise() }
    if (a.estado === 'pronto') { Som.liga(); pill('Análise pronta', 'Veja as sugestões e aplique o que fizer sentido.', 'var(--green)'); if (PF && a.id === PF.id) { PF.analise = { ...a.resultado, agente: a.agente, quando: new Date().toISOString() } } }
    else { Som.erro(); pill('A análise não deu certo', a.erro || '', 'var(--red)') }
    atualizarHumor(); if (atual?.dataset.scene === 'perfil') desenharPerfil()
  }, DEMO ? 800 : 3000)
}
// eventos da tela
$('[data-scene=perfil]').addEventListener('input', e => {
  const t = e.target
  if (t.dataset.pf) { const k = t.dataset.pf; definePf(PF, k, ['temas', 'evitar'].includes(k) ? t.value.split(',').map(s => s.trim()).filter(Boolean) : t.value); return pfMudou() }
  if (t.dataset.pfCor) { PF.marca.cores[t.dataset.pfCor] = t.value; const h = $(`[data-pf-hex="${t.dataset.pfCor}"]`); h.value = t.value; t.classList.remove('vazia'); return pfMudou() }
  if (t.dataset.pfHex) { const v = t.value.trim().toLowerCase(); if (corOk(v) || v === '') { PF.marca.cores[t.dataset.pfHex] = v; if (v) $(`[data-pf-cor="${t.dataset.pfHex}"]`).value = v; pfMudou() } return }
  const pl = t.closest('.pf-pilar'); if (pl && t.dataset.pl) { const p = PF.pilares[+pl.dataset.k]; p[t.dataset.pl] = t.dataset.pl === 'ideias' ? t.value.split('\n').map(s => s.trim()).filter(Boolean) : t.value; pfMudou() }
})
$('[data-scene=perfil]').addEventListener('change', e => {
  const t = e.target
  if (t.dataset.pfChk) { PF.marca[t.dataset.pfChk] = t.checked; pfMudou() }
  if (t.matches('[data-pf-sel]')) { (pfSujo ? salvarPerfil({ quieto: true }) : Promise.resolve()).then(() => carregarPerfil(t.value)) }
  if (t.closest('.pf-pilar') && t.dataset.pl === 'ideias') desenharPilares()
})
$('[data-scene=perfil]').addEventListener('click', async e => {
  const t = e.target.closest('button'); if (!t) return
  if (t.closest('[data-pf-chips]')) { const k = t.closest('[data-pf-chips]').dataset.pfChips, v = t.dataset.v, atual_ = (PF[k] || '').split(/,\s*/).filter(Boolean); PF[k] = (atual_.includes(v) ? atual_.filter(x => x !== v) : [...atual_, v]).join(', '); Som.tique(); pfMudou(); return desenharPerfil() }
  if (t.dataset.pfRef) { const r = PF.marca.referencias, i = r.indexOf(t.dataset.pfRef); i >= 0 ? r.splice(i, 1) : r.length < 3 ? r.push(t.dataset.pfRef) : pill('Até 3 referências', 'Tire uma antes de escolher outra.', 'var(--amber)'); Som.tique(); pfMudou(); return desenharPerfil() }
  if (t.matches('[data-pf-pilar-add]')) { PF.pilares.push({ tema: '', por_que: '', ideias: [] }); pfMudou(); desenharPilares(); return $$('.pf-pilar [data-pl=tema]').pop()?.focus() }
  if (t.dataset.plTirar != null) { PF.pilares.splice(+t.dataset.plTirar, 1); pfMudou(); return desenharPilares() }
  if (t.dataset.ideia) { const [k, n] = t.dataset.ideia.split(':').map(Number), ideia = PF.pilares[k].ideias[n]; return abrirEditor({ titulo: ideia.slice(0, 80), legenda: '' , dica: `Ideia do pilar "${PF.pilares[k].tema}": ${ideia}` }) }
  if (t.dataset.aplicar) return aplicarSugestao(t.dataset.aplicar)
  if (t.matches('[data-pf-ir]')) {
    if (pfSujo) await salvarPerfil({ quieto: true })
    VC_EDITAR = { passo: +t.dataset.pfIr, id: PF.id }; voltarPara = 'perfil'; Som.tique(); return cena('voce')
  }
  if (t.matches('[data-pf-analisar]')) return analisarPerfil()
  if (t.matches('[data-pf-salvar]')) return salvarPerfil()
})
