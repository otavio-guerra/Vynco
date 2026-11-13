'use strict'
// Vynco: Início: próximos posts, "Para interagir hoje" e "Peça à sua IA".
// Carregado depois de app.js (index.html); usa as funções e o estado globais de lá.

// ---------------------------------------------------------------- início: o que vai ao ar, o que espera você e o que a IA vai fazer
let INI_ROT = [], INI_AUTO = false, INI_FREQ = ''
// ---------------------------------------------------------------- "Para interagir hoje" (Início): constância de comentar, sem automatizar nada no LinkedIn
let INT = null, intT = null, INT_TODAS = false, INT_COPIOU = null
// há quanto tempo (para os posts que acabaram de sair)
const haQuanto = ms => { const m = Math.max(1, Math.round((Date.now() - ms) / 60000)); return m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.round(m / 60)} h` : `há ${Math.round(m / 1440)} ${Math.round(m / 1440) === 1 ? 'dia' : 'dias'}` }
const urlPosts = q => 'https://www.linkedin.com/search/results/content/?keywords=' + encodeURIComponent(q) + '&datePosted=%22past-24h%22&sortBy=%22date_posted%22'
async function carregarInteracao() {
  const era = INT?.job?.estado
  try { INT = await api('/api/interacao') } catch { return }
  desenharInteracao()
  clearTimeout(intT)
  if (INT.job?.estado === 'rodando') intT = setTimeout(carregarInteracao, DEMO ? 800 : 3000)
  else if (era === 'rodando' && (atualizarHumor(), true)) INT.job?.estado === 'pronto' ? (Som.liga(), pill('Ideias prontas', 'Escolha uma, copie e complete com o assunto do post.', 'var(--green)')) : (Som.erro(), pill('Não deu para gerar as ideias', INT.job?.erro || '', 'var(--red)'))
}
function desenharInteracao() {
  const box = $('[data-ini-interagir]'); if (!box || !INT) return
  const { hoje, meta, sequencia, semana } = INT, pct = Math.min(100, Math.round(100 * hoje / meta)), ok = hoje >= meta
  const termos = (INT.buscas.length ? INT.buscas : [INT.perfil.area, ...[].concat(INT.perfil.temas || [])]).map(x => String(x || '').trim()).filter(Boolean).slice(0, 5)
  const maxS = Math.max(meta, ...semana.map(d => d.n)), rodando = INT.job?.estado === 'rodando'
  const ideias = INT_TODAS ? INT.ideias : INT.ideias.slice(0, 2)
  box.innerHTML = `<header class="ini-h"><h2>Para interagir hoje</h2>${sequencia ? `<span class="int-seq" title="Dias seguidos com pelo menos um comentário">${icr('estrela')}${sequencia} ${sequencia === 1 ? 'dia' : 'dias'}</span>` : ''}</header>
    <div class="int-meta${ok ? ' ok' : ''}">
      <div class="int-top"><b>${hoje}<small> de ${meta}</small></b><span>${ok ? 'meta do dia cumprida' : `${hoje ? `faltam ${meta - hoje}` : `comentário${meta === 1 ? '' : 's'} hoje`}`}</span>
        <label class="int-m" title="Meta de comentários por dia"><span>meta</span><select data-int-meta aria-label="Meta de comentários por dia">${[1, 2, 3, 4, 5, 8, 10].map(n => `<option value="${n}"${n === meta ? ' selected' : ''}>${n}</option>`).join('')}</select></label></div>
      <i class="int-barra"><em style="width:${pct}%"></em></i>
      <div class="int-a"><button class="btn sm accent" type="button" data-int="comentei">${icr('carta')}Comentei</button>${hoje ? '<button class="link soft" type="button" data-int="desfazer">Desfazer</button>' : ''}
        <span class="int-sem" aria-label="Comentários nos últimos 7 dias">${semana.map(d => `<i title="${new Date(d.dia + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' })}: ${d.n}" style="--h:${Math.max(8, Math.round(100 * d.n / maxS))}%" class="${d.n ? 'on' : ''}"></i>`).join('')}</span></div>
    </div>
    ${(() => {
      const rec = (typeof FILA !== 'undefined' ? FILA : []).filter(x => x.published?.quando && Date.now() - Date.parse(x.published.quando) < 48 * 36e5).sort((a, b) => Date.parse(b.published.quando) - Date.parse(a.published.quando)).slice(0, 3)
      return rec.length ? `<div class="int-bl int-resp"><span class="cm-k">Responda quem comentou</span>
        <ul class="int-posts">${rec.map(x => `<li><span><b title="${esc(x.title)}">${esc(x.title)}</b><small>saiu ${haQuanto(Date.parse(x.published.quando))}</small></span><a class="btn sm" href="${esc(urlOk(x.published.link || 'https://www.linkedin.com/notifications/'))}" target="_blank" rel="noopener">${x.published.link ? 'Abrir o post' : 'Notificações'}${icr('externo', 'icr mini')}</a></li>`).join('')}</ul>
        <p class="fine">Responder cedo mantém a conversa viva no seu post.</p></div>` : ''
    })()}
    ${termos.length ? `<div class="int-bl"><span class="cm-k">Posts das últimas 24 horas</span><div class="chips">${termos.map(q => `<a class="chip-link" href="${esc(urlPosts(q))}" target="_blank" rel="noopener">${esc(q)}${icr('externo', 'icr mini')}</a>`).join('')}</div></div>` : ''}
    <div class="int-bl"><span class="cm-k">Ideias de comentário${INT.ideiasEm ? ` · ${quando(Date.parse(INT.ideiasEm))}` : ''}</span>
      ${ideias.length ? `<ul class="int-ideias">${ideias.map((x, i) => `<li><small>${esc(x.angulo)}${x.tema ? ' · ' + esc(x.tema) : ''}</small><p>${esc(x.comeco)}</p><span class="int-ia"><button class="link" type="button" data-int-copia="${i}">${icr('copiar')}${INT_COPIOU === i ? 'Copiar de novo' : 'Copiar'}</button>${INT_COPIOU === i ? `<button class="btn sm accent" type="button" data-int="comentei">${icr('carta')}Comentei</button>` : ''}</span></li>`).join('')}</ul>${INT.ideias.length > 2 ? `<button class="link soft" type="button" data-int="todas">${INT_TODAS ? 'Mostrar menos' : `Ver todas (${INT.ideias.length})`}</button>` : ''}`
        : `<p class="fine">A sua IA sugere ângulos e um começo de comentário no seu tom, a partir do seu perfil. Você completa com o assunto do post.</p>`}
      <button class="btn sm" type="button" data-int="ideias"${rodando ? ' disabled' : ''}>${rodando ? '<span class="spin"></span>Preparando ideias…' : INT.ideias.length ? 'Novas ideias' : 'Sugerir ideias'}</button>
    </div>
    <p class="fine int-nota">Curtir e comentar é com você, no LinkedIn. O Vynco não lê nem publica no feed.</p>`
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-int]'), c = e.target.closest('[data-int-copia]')
  if (c) { try { const i = +c.dataset.intCopia; await navigator.clipboard.writeText(INT.ideias[i].comeco); Som.tique(); INT_COPIOU = i; desenharInteracao(); pill('Copiado', 'Cole no comentário, complete com o assunto do post e marque "Comentei".', 'var(--green)') } catch { pill('Não consegui copiar', 'Selecione e copie à mão.', 'var(--amber)') } return }
  if (!b) return
  const q = b.dataset.int
  if (q === 'todas') { INT_TODAS = !INT_TODAS; return desenharInteracao() }
  try {
    if (q === 'ideias') { INT = await api('/api/interacao/ideias', {}); INT.job = { estado: 'rodando' }; humor('work'); desenharInteracao(); clearTimeout(intT); intT = setTimeout(carregarInteracao, DEMO ? 800 : 3000); return }
    const antes = INT.hoje
    if (q === 'comentei') INT_COPIOU = null
    INT = await api('/api/interacao', { acao: q }); desenharInteracao()
    if (q === 'comentei') { Som.tique(); if (antes < INT.meta && INT.hoje >= INT.meta) { Som.liga(); window.fx?.confete(innerWidth - 220, 260, 60); pill('Meta do dia cumprida', 'Boa! Constância pesa mais que volume.', 'var(--green)') } }
  } catch (err) { falha(err) }
})
document.addEventListener('change', async e => { if (!e.target.matches('[data-int-meta]')) return; try { INT = await api('/api/interacao', { acao: 'meta', n: +e.target.value }); Som.tique(); desenharInteracao() } catch (err) { falha(err) } })

// ---------------------------------------------------------------- "Peça à sua IA" (Início): um pedido em texto vira um plano que você confere antes de qualquer gasto
let PED = null, pedT = null, PED_TODOS = false
const PED_ROT = ['Vídeo para hoje à tarde', 'Fotos da pasta, todo dia útil', 'Carrossel com 5 dicas', 'Pergunta para a rede']
const PED_EX = ['Um vídeo curto sobre o meu processo de trabalho, para hoje à tarde', 'Todo dia útil, um post com as fotos novas da pasta C:\\Users\\voce\\Pictures\\Obra sobre o avanço do trabalho', 'Um carrossel com 5 dicas sobre a minha área para sexta de manhã', 'Um post de texto com uma pergunta para a rede, amanhã no almoço']
const PED_VIVO = ['entendendo', 'fazendo', 'esperando-midia']
const PED_EST = { entendendo: ['Entendendo', ''], conferir: ['Confira antes', 'warn'], fazendo: ['Fazendo', ''], 'esperando-midia': ['Esperando o Magnific', ''], pronto: ['Pronto em Revisar', 'ok'], falhou: ['Não deu certo', 'bad'], pulado: ['Pulado hoje', 'soft'], cancelado: ['Cancelado', 'soft'], repetindo: ['Virou repetição', 'ok'] }
const DIA_C = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const milT = n => n == null ? '—' : n >= 1000 ? `${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: n >= 1e5 ? 0 : 1 })} mil` : String(n)
const nomeMod = m => { const r = /claude-([a-z]+)-(\d+)-(\d+)/i.exec(String(m || '')); return r ? `${r[1][0].toUpperCase()}${r[1].slice(1)} ${r[2]}.${r[3]}` : String(m || '').split(',')[0] }
const isoLocal = q => { if (!q) return ''; const d = new Date(q); return isNaN(d) ? '' : `${ymd(d)}T${d.toTimeString().slice(0, 5)}` }
const diasTxt = d => { const s = [...d].sort().join(','); return s === '1,2,3,4,5' ? 'de segunda a sexta' : s === '0,1,2,3,4,5,6' ? 'todo dia' : d.map(x => DIA_C[x]).join(', ') }
async function carregarPedidos() {
  const vivos = (PED?.pedidos || []).filter(p => PED_VIVO.includes(p.estado)).map(p => p.id + p.estado)
  try { PED = await api('/api/pedidos') } catch { return }
  desenharPedidos()
  clearTimeout(pedT)
  const agora = PED.pedidos.filter(p => PED_VIVO.includes(p.estado))
  if (agora.length) pedT = setTimeout(carregarPedidos, DEMO ? 700 : 3000)
  // o que mudou de estado desde a última leitura
  for (const k of vivos) { const p = PED.pedidos.find(x => k.startsWith(x.id)); if (!p || PED_VIVO.includes(p.estado)) continue
    if (p.estado === 'pronto') { Som.liga(); pill('Pedido pronto', 'Está em Revisar esperando você aprovar.', 'var(--green)'); if (!$('[data-scene=inicio]').hidden) carregarInicio(); else contarFila() }
    else if (p.estado === 'conferir') { Som.tique(); pill('Plano pronto', 'Confira o que a IA entendeu antes de fazer.', 'var(--accent)') }
    else if (p.estado === 'falhou') { Som.erro(); pill('O pedido não deu certo', p.erro || '', 'var(--red)') } }
}
function usoLinha(rot, u, extra = '') {
  if (!u) return `<li><span class="pd-k">${rot}</span><span class="pd-v">${extra}</span></li>`
  const custo = u.custoUsd != null ? ` · equivale a US$ ${u.custoUsd.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} na API` : ''
  return `<li><span class="pd-k">${rot}</span><span class="pd-v"><b>${u.estimado ? '~' : ''}${milT(u.total)} tokens</b> · ${esc(u.ia)}${u.modelo && !u.ia.includes('·') ? ' ' + esc(nomeMod(u.modelo)) : ''}${custo}${u.cache ? `<small>${milT(u.cache)} lidos do cache (mais baratos)</small>` : ''}${u.estimado ? '<small>esta IA não informa o uso: estimado pelo tamanho do texto</small>' : ''}</span></li>`
}
function cartaoPedido(p) {
  const [rot, tom] = PED_EST[p.estado] || [p.estado, ''], pl = p.plano || {}, cf = p.conferencia || {}, u = p.uso || {}
  const cab = `<header class="pd-h"><p class="pd-t">“${esc(p.texto)}”</p><span class="pd-e ${tom}">${PED_VIVO.includes(p.estado) ? '<span class="spin"></span>' : ''}${rot}</span></header>`
  if (p.estado === 'entendendo') return `<article class="pd">${cab}<p class="fine">A ${esc(PED?.ia?.barata || 'IA')} está lendo o pedido. Só raciocínio: nada é criado ainda.</p></article>`
  const passos = (p.passos || []).length ? `<ol class="pd-passos">${p.passos.map(x => `<li>${esc(x.texto)}</li>`).join('')}</ol>` : ''
  const gasto = u.resumo && u.resumo !== 'nada' ? `<p class="pd-gasto">${icr('nivel')}Gasto: ${esc(u.resumo)}</p>` : ''
  if (p.estado === 'conferir') {
    const fmt = Object.entries(PED.formatos || {}).map(([v, n]) => `<option value="${v}"${v === pl.formato ? ' selected' : ''}>${esc(n)}</option>`).join('')
    const usaPasta = pl.formato === 'fotos' || pl.formato === 'video', rep = pl.repetir
    const mg = cf.magnific, es = cf.escrever
    return `<article class="pd pd-conf" data-pd="${esc(p.id)}">${cab}
      <p class="pd-resumo">${esc(pl.resumo || 'A IA montou o plano abaixo.')}</p>
      ${(cf.bloqueios || []).map(t => `<p class="ini-alerta bad">${esc(t)}</p>`).join('')}${(cf.avisos || []).map(t => `<p class="ini-alerta">${esc(t)}</p>`).join('')}
      <div class="pd-campos">
        <label><span>Formato</span><select data-pd-c="formato">${fmt}</select></label>
        <label class="pd-tema"><span>Tema</span><input data-pd-c="tema" value="${esc(pl.tema || '')}" maxlength="200"></label>
        ${usaPasta ? `<label class="pd-pasta"><span>${pl.formato === 'video' ? 'Pasta das fotos (opcional: o vídeo anima a mais recente)' : 'Pasta das fotos'}${cf.fotos ? ` · <b>${cf.fotos.novas}</b> ${cf.fotos.novas === 1 ? 'foto nova' : 'fotos novas'}` : ''}</span><input data-pd-c="pasta" value="${esc(pl.pasta || '')}" placeholder="C:\\Users\\voce\\Pictures\\Obra" spellcheck="false"></label>` : ''}
        ${pl.formato === 'fotos' ? `<label><span>Fotos por post</span><select data-pd-c="quantasFotos">${[1, 2, 3, 4, 5, 6, 9].map(n => `<option${n === pl.quantasFotos ? ' selected' : ''}>${n}</option>`).join('')}</select></label>` : ''}
        <fieldset class="pd-quando"><legend>Quando</legend>
          <div class="pd-modo" role="radiogroup"><button type="button" data-pd-modo="uma" aria-pressed="${!rep}">Uma vez</button><button type="button" data-pd-modo="rep" aria-pressed="${!!rep}">Repetir</button></div>
          ${rep ? `<div class="pd-dias">${[1, 2, 3, 4, 5, 6, 0].map(d => `<button type="button" data-pd-dia="${d}" aria-pressed="${rep.dias.includes(d)}">${DIA_C[d]}</button>`).join('')}</div>
            <div class="pd-linha"><label><span>Criar às</span><input type="time" data-pd-c="hora" value="${esc(rep.hora)}"></label><label><span>Agendar cada post para</span><input type="time" data-pd-c="horaPublicar" value="${esc(pl.horaPublicar || '')}"></label></div>`
            : `<label><span>Vai ao ar</span><input type="datetime-local" data-pd-c="quando" value="${isoLocal(pl.quando)}"></label><small class="fine">${pl.quando ? 'Entra na agenda, mas só sai se você aprovar até lá.' : 'Sem horário: fica em Revisar e você escolhe quando sai.'}</small>`}
        </fieldset>
      </div>
      <div class="pd-usa"><span class="cm-k">O que vai usar</span><ul>
        ${usoLinha('Entender', u.entender)}
        <li><span class="pd-k">Escrever</span><span class="pd-v"><b>${esc(es?.ia || 'sua IA')}</b>${es?.modelo ? ' · ' + esc(es.modelo) : ''}${es?.esforco ? ' · esforço ' + esc(es.esforco) : ''}<small>${es?.antes ? `da última vez, ~${milT(es.antes.tokens)} tokens (média de ${es.antes.vezes})` : 'o gasto real aparece aqui quando terminar'}</small></span></li>
        ${mg ? `<li><span class="pd-k">Magnific</span><span class="pd-v"><b>1 ${mg.op === 'video' ? 'vídeo' : 'imagem'}</b> · ${esc(mg.modelo)}<small>${mg.valor != null ? `~€${mg.valor}` : 'preço não publicado pelo Magnific: confira no painel'}${mg.usoMes ? ` · ${mg.usoMes.operacoes} de ${mg.usoMes.limite} operações neste mês` : ''}</small></span></li>` : ''}
      </ul></div>
      ${rep && mg ? `<label class="pd-ok"><input type="checkbox" data-pd-mg> Pode usar o Magnific em cada repetição (gasta créditos todo dia)</label>` : ''}
      ${rep ? `<label class="pd-ok"><input type="checkbox" data-pd-agora checked> Fazer o primeiro agora</label>` : ''}
      <div class="pd-a"><button class="btn sm accent" type="button" data-pd-ir${(cf.bloqueios || []).length ? ' disabled' : ''}>${rep ? 'Criar a repetição' : 'Fazer agora'}</button><button class="link soft" type="button" data-pd-x="cancelar">Cancelar</button></div>
    </article>`
  }
  const fim = p.estado === 'pronto' ? `<div class="pd-a"><button class="btn sm accent" type="button" data-ini-abrir="${esc(p.post.kind + ':' + p.post.id)}">Ver em Revisar</button>${p.agendado ? `<span class="fine">agendado: ${esc(quandoRel(p.agendado))}</span>` : ''}</div>`
    : ['falhou', 'pulado', 'cancelado'].includes(p.estado) ? `${p.erro ? `<p class="ini-alerta ${p.estado === 'falhou' ? 'bad' : ''}">${esc(p.erro)}</p>` : ''}<div class="pd-a"><button class="btn sm" type="button" data-pd-x="denovo">Pedir de novo</button><button class="link soft" type="button" data-pd-x="apagar">Tirar da lista</button>${p.log ? `<a class="link soft" href="${arquivo(p.log)}" target="_blank" rel="noopener">Ver o registro</a>` : ''}</div>`
    : PED_VIVO.includes(p.estado) ? `<div class="pd-a"><button class="link soft" type="button" data-pd-x="cancelar">Parar</button></div>` : ''
  return `<article class="pd" data-pd="${esc(p.id)}">${cab}${pl.resumo ? `<p class="pd-resumo">${esc(pl.resumo)}</p>` : ''}${passos}${gasto}${fim}</article>`
}
function desenharPedidos() {
  const box = $('[data-ini-pedir]'); if (!box || !PED) return
  const ativos = PED.pedidos.filter(p => p.estado !== 'repetindo' || !p.daRepeticao), lista = PED_TODOS ? ativos : ativos.slice(0, 3)
  const rascunho = box.querySelector('[data-pd-texto]')?.value || ''
  box.innerHTML = `<form class="pd-f" data-pd-form>
      <label class="pd-ic" for="pd-texto">${icr('estrela')}</label>
      <textarea id="pd-texto" data-pd-texto rows="1" maxlength="1500" placeholder="Peça à sua IA. Ex.: um vídeo sobre o meu processo, para hoje à tarde" aria-label="O que você quer que a sua IA faça">${esc(rascunho)}</textarea>
      <button class="btn accent" type="submit"${PED.ia ? '' : ' disabled'}>Pedir</button>
    </form>
    <div class="pd-sob">
      <div class="pd-ex">${PED_EX.map((t, i) => `<button type="button" class="chip-link" data-pd-ex="${i}" title="${esc(t)}">${esc(PED_ROT[i] || t)}</button>`).join('')}</div>
      <p class="fine">${PED.ia ? `Quem entende: <b>${esc(PED.ia.barata)}</b> (só raciocínio, gasta pouco). Quem faz: <b>${esc(PED.ia.principal)}</b>, e o Magnific quando o pedido for imagem ou vídeo. Você confere o plano e o gasto antes; nada vai ao ar sem a sua aprovação.` : 'Conecte uma IA em Ajustes para fazer pedidos.'}</p>
    </div>
    ${lista.length ? `<div class="pd-lista">${lista.map(cartaoPedido).join('')}</div>${ativos.length > 3 ? `<button class="link soft" type="button" data-pd-todos>${PED_TODOS ? 'Mostrar menos' : `Ver todos os pedidos (${ativos.length})`}</button>` : ''}` : ''}
    ${PED.repeticoes.length ? `<div class="pd-reps"><span class="cm-k">Repetições</span><ul>${PED.repeticoes.map(r => `<li class="${r.ativo ? '' : 'off'}" data-pd-rep="${esc(r.id)}"><div><b>${esc(r.resumo || r.texto)}</b><small>${esc(PED.formatos[r.formato] || r.formato)} · ${diasTxt(r.dias)}, cria às ${esc(r.hora)}${r.horaPublicar ? `, agenda para ${esc(r.horaPublicar)}` : ''}${r.pasta ? ` · ${esc(r.pasta)}` : ''} · ${r.feitos} ${r.feitos === 1 ? 'post feito' : 'posts feitos'}</small></div><button class="link" type="button" data-pd-rep-a="${r.ativo ? 'pausar' : 'retomar'}">${r.ativo ? 'Pausar' : 'Retomar'}</button><button class="link soft" type="button" data-pd-rep-a="apagar">Apagar</button></li>`).join('')}</ul></div>` : ''}`
  const ta = box.querySelector('[data-pd-texto]'); autoAltura(ta)
}
const autoAltura = ta => { if (!ta) return; ta.style.height = 'auto'; ta.style.height = Math.min(160, ta.scrollHeight) + 'px' }
async function enviarPedido(texto) {
  texto = String(texto || '').trim(); if (texto.length < 6) return pill('Escreva o pedido', 'Diga o que a sua IA deve fazer.', 'var(--amber)')
  try { await api('/api/pedidos', { texto }); const ta = $('[data-pd-texto]'); if (ta) ta.value = ''; humor('work'); Som.tique(); carregarPedidos() } catch (e) { falha(e) }
}
async function ajustarPedido(id, plano) { try { const p = await api('/api/pedidos/ajustar', { id, plano }); const i = PED.pedidos.findIndex(x => x.id === id); if (i >= 0) PED.pedidos[i] = { ...p, uso: PED.pedidos[i].uso ? { ...p.uso, resumo: PED.pedidos[i].uso.resumo } : p.uso }; desenharPedidos() } catch (e) { falha(e) } }
document.addEventListener('submit', e => { if (!e.target.matches('[data-pd-form]')) return; e.preventDefault(); enviarPedido(e.target.querySelector('[data-pd-texto]').value) })
document.addEventListener('keydown', e => { if (e.target.matches?.('[data-pd-texto]') && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarPedido(e.target.value) } })
document.addEventListener('input', e => { if (e.target.matches?.('[data-pd-texto]')) autoAltura(e.target) })
document.addEventListener('click', async e => {
  const ex = e.target.closest('[data-pd-ex]'); if (ex) { const ta = $('[data-pd-texto]'); ta.value = PED_EX[+ex.dataset.pdEx]; autoAltura(ta); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); return }
  if (e.target.closest('[data-pd-todos]')) { PED_TODOS = !PED_TODOS; return desenharPedidos() }
  const card = e.target.closest('[data-pd]'), id = card?.dataset.pd, p = id && PED?.pedidos.find(x => x.id === id)
  const rep = e.target.closest('[data-pd-rep-a]')
  if (rep) { const rid = rep.closest('[data-pd-rep]').dataset.pdRep, a = rep.dataset.pdRepA; if (a === 'apagar' && !confirm('Apagar esta repetição? Os posts que ela já fez continuam em Revisar.')) return; try { await api('/api/pedidos/repeticao', a === 'apagar' ? { id: rid, apagar: true } : { id: rid, ativo: a === 'retomar' }); Som.tique(); carregarPedidos() } catch (err) { falha(err) } return }
  if (!p) return
  const modo = e.target.closest('[data-pd-modo]'); if (modo) return ajustarPedido(id, modo.dataset.pdModo === 'rep' ? { repetir: p.plano.repetir || { dias: [1, 2, 3, 4, 5], hora: '08:00' } } : { repetir: null })
  const dd = e.target.closest('[data-pd-dia]'); if (dd) { const d = +dd.dataset.pdDia, r = p.plano.repetir, dias = r.dias.includes(d) ? r.dias.filter(x => x !== d) : [...r.dias, d]; if (!dias.length) return; return ajustarPedido(id, { repetir: { ...r, dias } }) }
  if (e.target.closest('[data-pd-ir]')) {
    const b = e.target.closest('[data-pd-ir]'); b.disabled = true
    try { await api('/api/pedidos/confirmar', { id, agora: card.querySelector('[data-pd-agora]') ? card.querySelector('[data-pd-agora]').checked : true, magnificTodoDia: !!card.querySelector('[data-pd-mg]')?.checked }); humor('work'); Som.liga(); carregarPedidos() } catch (err) { b.disabled = false; falha(err) }
    return
  }
  const x = e.target.closest('[data-pd-x]')?.dataset.pdX; if (!x) return
  try {
    if (x === 'cancelar') await api('/api/pedidos/cancelar', { id })
    if (x === 'apagar') await api('/api/pedidos/apagar', { id })
    if (x === 'denovo') { await api('/api/pedidos/apagar', { id }); return enviarPedido(p.texto) }
    carregarPedidos()
  } catch (err) { falha(err) }
})
document.addEventListener('change', e => {
  const c = e.target.closest?.('[data-pd-c]'); if (!c) return
  const id = c.closest('[data-pd]').dataset.pd, p = PED.pedidos.find(x => x.id === id), k = c.dataset.pdC, v = c.value
  if (k === 'hora') return ajustarPedido(id, { repetir: { ...p.plano.repetir, hora: v || '08:00' } })
  if (k === 'quando') return ajustarPedido(id, { quando: v ? new Date(v).toISOString() : null })
  ajustarPedido(id, { [k]: k === 'quantasFotos' ? +v : v, ...(k === 'pasta' ? { limparDuvida: true } : {}) })
})

async function carregarInicio() {
  carregarInteracao(); carregarPedidos()
  try { const [f, r, au, pf] = await Promise.all([api('/api/queue'), api('/api/runs').catch(() => ({ rotinas: [] })), api('/api/automatico').catch(() => null), api('/api/perfil').then(x => x.perfil).catch(() => null), ST ? null : status()]); INI_FREQ = pf?.frequencia || ''; FILA = f; INI_ROT = (r.rotinas || []).filter(x => x.agenda?.ativo); INI_AUTO = !!au?.ativo } catch (e) { return falha(e) }
  desenharInicio(); desenharInteracao(); contarFila(); atualizarHumor()
}
const quandoRel = q => {
  const d = new Date(q), h = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), dias = Math.round((new Date(ymd(d) + 'T12:00') - new Date(hoje0() + 'T12:00')) / 864e5)
  return dias === 0 ? `Hoje, ${h}` : dias === 1 ? `Amanhã, ${h}` : `${d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' })}, ${h}`
}
function proximaRotina(r) {   // o próximo dia e hora em que a rotina roda
  const [hh, mm] = (r.agenda.hora || '08:00').split(':').map(Number), agora = new Date()
  for (let k = 0; k < 8; k++) { const x = new Date(agora); x.setDate(agora.getDate() + k); x.setHours(hh, mm, 0, 0); if ((r.agenda.dias || []).includes(x.getDay()) && x > agora) return x }
  return null
}
function desenharInicio() {
  const nome = (ST?.linkedin?.name || '').split(' ')[0], h = new Date().getHours()
  $('[data-ini-t]').textContent = `${h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'}${nome ? ', ' + nome : ''}.`
  const ag = FILA.filter(i => i.agendado && !i.published).sort((a, b) => a.agendado.localeCompare(b.agendado))
  const esp = FILA.filter(CONTA.pendente), pub = FILA.filter(i => i.published).sort((a, b) => String(b.published.quando || '').localeCompare(String(a.published.quando || '')))
  const sem7 = ag.filter(i => new Date(i.agendado) - Date.now() <= 7 * 864e5).length, semAprov = ag.filter(i => !i.approved).length
  $('[data-ini-s]').textContent = ag.length ? `O próximo post sai ${quandoRel(ag[0].agendado).toLowerCase()}. ${ag.length === 1 ? 'Só ele está na agenda.' : `Há ${ag.length} posts na agenda.`}` : esp.length ? 'Nada agendado ainda. Revise o que está esperando e escolha quando sai.' : 'Nada agendado ainda. Peça um post à sua IA em Criar.'
  const li = ST?.linkedin || {}
  // números que ajudam a decidir: a semana contra a meta, o que espera você, quando sai o próximo e o que já saiu
  const ic = d => `<i class="ini-ic" aria-hidden="true"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}</svg></i>`
  const seg = new Date(); seg.setHours(0, 0, 0, 0); seg.setDate(seg.getDate() - ((seg.getDay() + 6) % 7)); const dom = new Date(seg); dom.setDate(seg.getDate() + 7)
  const naSemana = q => q && new Date(q) >= seg && new Date(q) < dom
  const semana = FILA.filter(i => naSemana(i.published?.quando) || (!i.published && naSemana(i.agendado))).length
  const meta = /todo dia/i.test(INI_FREQ) ? 5 : /1 vez/i.test(INI_FREQ) ? 1 : /2 a 3/i.test(INI_FREQ) ? 3 : 0
  const mes = pub.filter(i => String(i.published.quando || '').slice(0, 7) === hoje0().slice(0, 7)).length
  const faltaC = q => { const m = Math.round((new Date(q) - Date.now()) / 60000); return m < 60 ? `${Math.max(1, m)} min` : m < 1440 ? `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}` : `${Math.round(m / 1440)} ${Math.round(m / 1440) === 1 ? 'dia' : 'dias'}` }
  const chip = (icone, n, rot, view, extra = '', tom = '') => `<button type="button" class="ini-chip glass${tom}" data-view="${view}">${ic(icone)}<span class="ini-chip-c"><b>${n}</b><span>${rot}</span>${extra}</span></button>`
  $('[data-ini-resumo]').innerHTML =
    chip('<rect x="3" y="4" width="14" height="13" rx="2.5"/><path d="M3 8h14M7 2.5v3M13 2.5v3M7 12l2 2 4-4"/>', meta ? `${semana}<small>/${meta}</small>` : semana, meta ? 'posts nesta semana (meta do seu perfil)' : 'posts nesta semana', 'calendario', meta ? `<i class="ini-meta"><em style="width:${Math.min(100, Math.round(semana / meta * 100))}%"></em></i>` : '', semana >= meta && meta ? ' ok' : '')
    + chip('<rect x="3" y="3" width="14" height="14" rx="3"/><path d="m7 10 2 2 4-4.5"/>', esp.length, esp.length === 1 ? 'post esperando você' : 'posts esperando você', 'fila', '', esp.length ? ' warn' : '')
    + chip('<circle cx="10" cy="10" r="7"/><path d="M10 6v4l2.5 2"/>', ag[0] ? faltaC(ag[0].agendado) : '—', ag[0] ? 'para o próximo post' : 'nada agendado', 'calendario')
    + chip('<path d="M4 15 8 9l3 3 5-7"/><path d="M12 5h4v4"/>', mes, mes === 1 ? 'post no ar este mês' : 'posts no ar este mês', 'calendario')
  // o LinkedIn só aparece quando precisa de você
  const liAviso = !li.connected ? `<p class="ini-alerta bad">O LinkedIn não está conectado: nada vai ao ar. <button class="link" data-view="ajustes">Conectar em Ajustes</button></p>` : venceLogo(li) ? `<p class="ini-alerta">O acesso ao LinkedIn vence ${prazo(li.dias)}. Reconecte com um clique para não parar. <button class="link" data-view="ajustes">Reconectar</button></p>` : ''
  if (INI_AUTO) $('[data-ini-s]').textContent += ' Modo automático ligado: a IA cria e o Vynco aprova e agenda.'
  const sb = ST?.standby, avisoLi = liAviso, avisoSb = ag.length && sb?.disponivel && !sb.ligado ? `<p class="ini-alerta">O Vynco só publica com o app aberto. Ligue o modo standby: ele abre com o Windows, fica na bandeja e não perde nenhum horário. <button class="btn sm accent" data-act="standby-ligar">Ligar</button></p>` : ''
  const aviso = avisoLi + avisoSb + (semAprov ? `<p class="ini-alerta">${semAprov === 1 ? '1 post agendado ainda não foi aprovado' : `${semAprov} posts agendados ainda não foram aprovados`} e não vai ao ar assim. <button class="link" data-view="fila">Aprovar em Revisar</button></p>` : '')
  const falta = q => { const m = Math.round((new Date(q) - Date.now()) / 60000); return m < 60 ? `em ${Math.max(1, m)} min` : m < 24 * 60 ? `em ${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `em ${Math.round(m / 1440)} ${Math.round(m / 1440) === 1 ? 'dia' : 'dias'}` }
  const hero = $('[data-ini-hero]'), p0 = ag[0]
  hero.hidden = !p0
  if (p0) {
    const leg = (p0.caption || '').split('\n').filter(l => l.trim())
    hero.innerHTML = `<div class="ini-hero-capa">${capa(p0)}</div>
      <div class="ini-hero-c"><span class="ini-hero-k">PRÓXIMO POST · ${esc(falta(p0.agendado))}</span>
        <h2>${esc(leg[0] || p0.title)}</h2>
        <p>${esc(leg.slice(1).join(' ').slice(0, 180))}${leg.slice(1).join(' ').length > 180 ? '…' : ''}</p>
        <div class="ini-hero-m"><span class="ini-hero-q"><b>${quandoRel(p0.agendado)}</b></span><span class="ini-tag">${esc(FMT_TXT[p0.formato] || p0.formato || '')}</span><span class="ini-tag ${p0.approved ? 'ok' : 'warn'}">${p0.approved ? 'aprovado · sai sozinho' : 'falta aprovar'}</span></div>
        <div class="ini-acoes"><button class="btn sm accent" data-ini-abrir="${esc(chaveIt(p0))}">Ver a prévia</button><button class="link" data-ini-dia="${ymd(new Date(p0.agendado))}">Mudar o horário</button></div></div>`
  }
  const resto = ag.slice(1, 13), dias = []
  for (const i of resto) { const d = ymd(new Date(i.agendado)); let g = dias.find(x => x.d === d); if (!g) dias.push(g = { d, itens: [] }); g.itens.push(i) }
  const diaTxt = d => { const n = Math.round((new Date(d + 'T12:00') - new Date(hoje0() + 'T12:00')) / 864e5), dt = new Date(d + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' }); return n === 0 ? `Hoje · ${dt}` : n === 1 ? `Amanhã · ${dt}` : dt }
  $('[data-ini-feed-t]').textContent = p0 ? 'Depois dele' : 'Vai ao ar'
  $('[data-ini-feed]').innerHTML = ag.length ? aviso + (resto.length ? dias.map(g => `<div class="ini-dia"><h3 class="ini-dia-t">${esc(diaTxt(g.d))}<small>${g.itens.length} ${g.itens.length === 1 ? 'post' : 'posts'}</small></h3>${g.itens.map(i => `<div class="ini-post">
      <div class="ini-quando"><span class="ini-dot${i.approved ? '' : ' warn'}"></span><b>${new Date(i.agendado).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</b><small>${esc(i.title)} · ${i.approved ? 'aprovado, sai sozinho' : 'falta aprovar'}</small></div>
      ${cartaoFeed(i, { quandoTxt: quandoCurto(i.agendado) })}
      <div class="ini-acoes"><button class="btn sm" data-ini-abrir="${esc(chaveIt(i))}">Abrir em Revisar</button><button class="link" data-ini-dia="${ymd(new Date(i.agendado))}">Mudar o horário</button></div>
    </div>`).join('')}</div>`).join('') : '<p class="fine">Só o post acima está na agenda por enquanto.</p>') + (ag.length > 13 ? `<p class="fine ini-mais">E mais ${ag.length - 13} depois desses. <button class="link" data-view="calendario">Ver tudo na Agenda</button></p>` : '') : ''
  if (!ag.length) $('[data-ini-feed]').innerHTML = `<div class="empty glass"><h3>Nada agendado.</h3><p>${esp.length ? 'Você tem posts esperando. Aprove e escolha o dia: eles aparecem aqui como vão ficar no feed.' : 'Quando você agendar um post, ele aparece aqui exatamente como vai ficar no feed.'}</p><div class="cta small">${esp.length ? '<button class="btn sm accent" data-view="fila">Revisar agora</button>' : '<button class="btn sm accent" data-view="rotinas">Criar um post</button>'}</div></div>`
  $('[data-ini-esperando]').innerHTML = `<header class="ed-box-h"><h3>Esperando você</h3><span class="tag">${esp.length}</span></header>${esp.length ? `<div class="ini-mini">${esp.slice(0, 4).map(i => `<button type="button" class="ini-mini-it" data-ini-abrir="${esc(chaveIt(i))}" title="${esc(i.title)}">${capa(i)}</button>`).join('')}</div><button class="btn sm accent" data-view="fila">Revisar agora</button>` : '<p class="fine">Nada para revisar. Quando a sua IA terminar um post, ele aparece aqui.</p>'}`
  const rots = INI_ROT.map(r => ({ r, q: proximaRotina(r) })).filter(x => x.q).sort((a, b) => a.q - b.q)
  $('[data-ini-rotinas]').innerHTML = `<header class="ed-box-h"><h3>A sua IA vai criar</h3><button class="link" type="button" data-view="rotinas">Criar</button></header>${rots.length ? `<ul class="ini-lista">${rots.slice(0, 4).map(x => `<li><b>${esc(x.r.titulo)}</b><small>${quandoRel(x.q)} · vai para Revisar</small></li>`).join('')}</ul>` : '<p class="fine">Nenhum modelo se repete sozinho. Em Criar, "Repetir" escolhe os dias e a hora.</p>'}<p class="fine">Criar usa a sua IA (e os créditos dela). Publicar o que já está aprovado e agendado não usa: só precisa do Vynco aberto.</p>`
  $('[data-ini-noar]').innerHTML = `<header class="ed-box-h"><h3>No ar</h3><button class="link" type="button" data-ini-noar-ver>Ver tudo</button></header>${pub.length ? `<ul class="ini-lista">${pub.slice(0, 3).map(i => `<li><b>${esc(i.title)}</b><small>${i.published.quando ? new Date(i.published.quando).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }) : ''}${i.published.link ? ` · <a class="link" href="${esc(urlOk(i.published.link))}" target="_blank" rel="noopener">ver no LinkedIn ↗</a>` : ''}</small></li>`).join('')}</ul>` : '<p class="fine">Nada publicado pelo Vynco ainda.</p>'}`
}
$('[data-scene=inicio]').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return
  if (b.dataset.iniAbrir) return abrirNaFila(b.dataset.iniAbrir)
  if (b.dataset.iniDia) { const d = b.dataset.iniDia, n = new Date(d + 'T12:00'); CAL = { ano: n.getFullYear(), mes: n.getMonth(), dia: d }; AG_ABA = 'mes'; voltarPara = null; return cena('calendario') }
  if (b.matches('[data-ini-noar-ver]')) { AG_ABA = 'noar'; voltarPara = null; return cena('calendario') }
  if (b.dataset.q === 'mais') { const art = b.closest('.ini-post'), k = art?.querySelector('[data-ini-abrir]')?.dataset.iniAbrir, i = k && itemDe(k); if (i) art.querySelector('.fp').outerHTML = cartaoFeed(i, { aberto: !b.textContent.includes('menos'), quandoTxt: quandoCurto(i.agendado) }) }
})
