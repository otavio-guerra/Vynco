'use strict'
// Vynco: Rede: Conexões e Vagas (a IA pesquisa na web; convites e candidaturas são sempre do usuário).
// Carregado depois de app.js (index.html); usa as funções e o estado globais de lá.

// ---------------------------------------------------------------- rede: conexões e vagas (a IA pesquisa na web; convites e candidaturas são da pessoa)
// ícones de linha usados em Conexões e Vagas (traço 1.6, cor do texto)
const ICR = {
  alvo: '<circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="3"/><circle cx="8" cy="8" r=".5" fill="currentColor"/>',
  pessoas: '<circle cx="6" cy="6" r="2.4"/><circle cx="11.5" cy="6.8" r="1.9"/><path d="M1.8 13.5c.5-2.3 2.2-3.5 4.2-3.5s3.7 1.2 4.2 3.5M10.6 10.3c1.8 0 3.1.9 3.6 2.9"/>',
  pasta: '<rect x="2" y="5" width="12" height="9" rx="1.8"/><path d="M5.8 5V3.8a.9.9 0 0 1 .9-.9h2.6a.9.9 0 0 1 .9.9V5M2 9h12"/>',
  busca: '<circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3.5 3.5"/>',
  carta: '<rect x="2" y="3.5" width="12" height="9" rx="1.6"/><path d="m2.5 4.5 5.5 4.3 5.5-4.3"/>',
  copiar: '<rect x="5" y="5" width="8.5" height="8.5" rx="1.6"/><path d="M3 10.5V3.6A1.1 1.1 0 0 1 4.1 2.5H10"/>',
  local: '<path d="M8 14s4.5-4.2 4.5-7.6A4.5 4.5 0 0 0 3.5 6.4C3.5 9.8 8 14 8 14z"/><circle cx="8" cy="6.4" r="1.6"/>',
  casa: '<path d="M2.5 7.5 8 3l5.5 4.5V13a.8.8 0 0 1-.8.8H3.3a.8.8 0 0 1-.8-.8z"/><path d="M6.3 13.8V10h3.4v3.8"/>',
  predio: '<rect x="3" y="2.5" width="7" height="11" rx="1"/><path d="M10 6.5h3v7h-3M5.3 5.2h2.4M5.3 7.8h2.4M5.3 10.4h2.4"/>',
  hibrido: '<path d="M2 8h12M8 2v12"/><circle cx="8" cy="8" r="6"/>',
  nivel: '<path d="M3 13V9M8 13V6M13 13V3"/>',
  contrato: '<path d="M4 2.5h5.5L12.5 5.5V13a.8.8 0 0 1-.8.8H4.3a.8.8 0 0 1-.8-.8V3.3a.8.8 0 0 1 .8-.8z"/><path d="M9.3 2.5v3.2h3.2M6 9h4M6 11.3h3"/>',
  dinheiro: '<circle cx="8" cy="8" r="6"/><path d="M9.8 6.2c-.3-.7-1-1.1-1.8-1.1-1 0-1.7.6-1.7 1.4s.7 1.1 1.7 1.4 1.8.6 1.8 1.4-.8 1.4-1.8 1.4c-.8 0-1.5-.4-1.8-1.1M8 4v1.1M8 10.9V12"/>',
  relogio: '<circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 1.4"/>',
  externo: '<path d="M9.5 2.5h4v4M13.5 2.5 7.5 8.5"/><path d="M12 9.5V13a.8.8 0 0 1-.8.8H3.3a.8.8 0 0 1-.8-.8V5.3a.8.8 0 0 1 .8-.8H7"/>',
  escudo: '<path d="M8 2 13 4v4c0 3-2.2 5.2-5 6-2.8-.8-5-3-5-6V4z"/><path d="m5.8 8 1.6 1.6L10.4 6.5"/>',
  hashtag: '<path d="M6 2.5 4.6 13.5M11.4 2.5 10 13.5M3 6h10.5M2.5 10h10.5"/>',
  estrela: '<path d="m8 2.3 1.7 3.6 3.9.5-2.9 2.7.8 3.9L8 11.1 4.5 13l.8-3.9-2.9-2.7 3.9-.5z"/>',
  mao: '<path d="M5 8.5V4a1 1 0 0 1 2 0v3.5M7 7V3a1 1 0 0 1 2 0v4M9 7V4a1 1 0 0 1 2 0v5c0 2.8-1.7 4.5-4.2 4.5-1.6 0-2.7-.8-3.5-2.1L2.2 9.6a1 1 0 0 1 1.6-1.1L5 9.8"/>',
}
const icr = (n, cls = 'icr') => `<svg class="${cls}" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICR[n] || ICR.estrela}</svg>`
const icTipo = t => /hashtag|tema|#/i.test(t || '') ? 'hashtag' : /empresa|marca|compan/i.test(t || '') ? 'predio' : /comunidade|grupo/i.test(t || '') ? 'pessoas' : /newsletter|blog|revista|publica/i.test(t || '') ? 'carta' : /pessoa|criador|perfil|lider|líder/i.test(t || '') ? 'pessoas' : 'estrela'
const icModo = m => /remoto/i.test(m || '') ? 'casa' : /h[ií]brido/i.test(m || '') ? 'hibrido' : 'predio'
let RD = null, RD_P = { local: '', modalidade: '', senioridade: '' }, rdT = null, VG_F = 'todas'
const MODALIDADES = ['Remoto', 'Híbrido', 'Presencial'], NIVEIS = ['Júnior', 'Pleno', 'Sênior', 'Liderança']
async function carregarRede() {
  try { RD = await api('/api/rede') } catch (e) { return falha(e) }
  RD_P = { ...RD_P, ...(RD.rede.prefs || {}) }
  $('[data-rd=local]').value = RD_P.local || ''
  desenharRede()
  if (RD.estado?.estado === 'rodando') acompanharRede()
}
function desenharRede() {
  const r = RD.rede, rodando = RD.estado?.estado === 'rodando'
  for (const [k, ops] of [['modalidade', MODALIDADES], ['senioridade', NIVEIS]]) $(`[data-rd-chips="${k}"]`).innerHTML = ops.map(o => `<button type="button" data-v="${o}" class="${RD_P[k] === o ? 'on' : ''}">${o}</button>`).join('')
  $$('[data-rd-ir]').forEach(b => (b.disabled = rodando))
  const P = RD.perfil, obj = (P.objetivo || '').toLowerCase()
  $('[data-rd-sub]').textContent = !P.area ? 'Preencha a sua área em Estratégia: é dela que saem as sugestões.' : RD_FOCO === 'vagas' ? `Vagas públicas recentes para ${P.area}, com o link conferido pela sua IA.` : `Pessoas que ajudam o seu objetivo${obj ? ` (${obj})` : ''}. A busca já vem pronta para o LinkedIn, com um convite no seu tom.`
  $('[data-rd-estado]').innerHTML = rodando ? `<div class="steps glass"><li class="run"><span class="ic"></span><span><b>${esc(RD.agente ? `A sua IA (${RD.agente})` : 'A sua IA')} está pesquisando ${RD.estado.tipo === 'vagas' ? 'vagas' : RD.estado.tipo === 'conexoes' ? 'conexões' : 'conexões e vagas'}</b><small>Leva de 1 a 4 minutos. Os links das vagas são conferidos antes de aparecer.</small></span></li></div>`
    : RD.estado?.estado === 'falhou' ? `<p class="ed-erro">${esc(RD.estado.erro || 'A busca não deu certo.')}</p>` : r.quando ? `<p class="fine">Última busca em ${new Date(r.quando).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}${r.descartadas ? ` · ${r.descartadas} ${r.descartadas === 1 ? 'vaga descartada' : 'vagas descartadas'} por link quebrado` : ''}.</p>` : ''
  const ctx = $('[data-rd-ctx]')
  if (ctx) {
    const chips = (rot, v, i) => v ? `<div class="rd-ctx-l"><small>${icr(i)}${rot}</small><span>${String(v).split(/,\s*/).filter(Boolean).map(x => `<i>${esc(x)}</i>`).join('')}</span></div>` : ''
    ctx.innerHTML = `<div class="rd-ctx-c">${chips('Seu objetivo', P.objetivo, 'alvo')}${chips('Para quem você escreve', P.publico, 'pessoas')}${chips('Sua área', P.area, 'pasta')}${!P.objetivo && !P.publico ? '<p class="fine">Conte o seu objetivo e o seu público em Estratégia: as sugestões ficam mais certeiras.</p>' : ''}</div>
      <div class="rd-ctx-a"><button class="btn accent" data-rd-ir="conexoes"${rodando ? ' disabled' : ''}>${r.conexoes.length ? 'Sugerir de novo' : 'Sugerir conexões'}</button><button class="link" type="button" data-view="perfil">Ajustar em Estratégia</button></div>`
  }
  $('[data-rd-nc]').textContent = r.conexoes.length ? `${r.conexoes.length} ${r.conexoes.length === 1 ? "sugestão" : "sugestões"}` : ''
  const ordem = r.conexoes.map((c, i) => ({ c, i, ...notaConexao(c, RD.perfil) })).sort((a, b) => b.nota - a.nota)
  $('[data-rd-conexoes]').innerHTML = r.conexoes.length ? ordem.map(({ c, i, nota, motivos }) => `<article class="rd-card cx-card" style="--cx:${['var(--sec-rede)', 'var(--sec-agenda)', 'var(--sec-estrategia)', 'var(--sec-criar)', 'var(--sec-inicio)'][i % 5]}"><header class="cx-h"><span class="cx-av" aria-hidden="true">${icr('pessoas')}</span><b title="${esc(c.perfil)}">${esc(c.perfil)}</b>${anelNota(nota, 'Nota pelo seu perfil: decide contratação +3, da sua área +2, é o seu público +2, abre vagas +2, fala dos seus temas +1')}</header><p>${esc(c.por_que)}</p><p class="motivos">${motivos.length ? motivos.map(esc).join(' · ') : 'pouco a ver com o seu perfil'}</p>
      ${c.convite ? `<details class="rd-convite"><summary><small>${icr('carta')}Convite no seu tom</small><span class="cx-cont${c.convite.length > 200 ? ' muito' : ''}">${c.convite.length}/200</span></summary><span>${esc(c.convite)}</span></details>` : ''}
      <div class="rd-a cx-a"><a class="btn sm accent" href="${esc(urlOk(c.url))}" target="_blank" rel="noopener">${icr('busca')}Buscar no LinkedIn</a>${c.convite ? `<button class="btn sm" type="button" data-rd-copia="${i}" title="Copiar o convite">${icr('copiar')}Copiar</button>` : ''}<button class="btn sm" type="button" data-rd-anota="${i}" title="Anotar que você mandou o convite">${icr('carta')}Anotar</button></div></article>`).join('')
    : `<div class="es-vazio glass"><h3>Nenhuma sugestão ainda</h3><p>A sua IA indica os tipos de pessoa que mais ajudam o seu objetivo, com a busca pronta no LinkedIn e um convite no seu tom.</p><button class="btn accent sm" type="button" data-rd-ir="conexoes">Sugerir conexões</button></div>`
  desenharBuscas(); desenharConvites()
  $('[data-rd-seguir]').innerHTML = r.seguir?.length ? `<header class="rd-h"><h2>Para seguir</h2><span class="tag">${r.seguir.length}</span></header><div class="cx-seg-grid">${r.seguir.map(s => `<article class="cx-seg glass"><span class="cx-av sm" aria-hidden="true">${icr(icTipo(s.tipo + ' ' + s.nome))}</span><span><b>${esc(s.nome)}</b><small>${esc(s.tipo || '')}</small>${s.por_que ? `<p>${esc(s.por_que)}</p>` : ''}</span></article>`).join('')}</div>` : ''
  $('[data-rd-nv]').textContent = r.vagas.length ? `${r.vagas.length} ${r.vagas.length === 1 ? "vaga" : "vagas"}` : ''
  const mods = [...new Set(r.vagas.map(v => v.modalidade).filter(Boolean))]
  if (VG_F !== 'todas' && !mods.includes(VG_F)) VG_F = 'todas'
  $('[data-vg-filtro]').innerHTML = mods.length > 1 ? ['todas', ...mods].map(m => `<button type="button" data-vg-f="${esc(m)}" class="${VG_F === m ? 'on' : ''}">${m === 'todas' ? 'Todas' : esc(m)}<span class="n">${m === 'todas' ? r.vagas.length : r.vagas.filter(v => v.modalidade === m).length}</span></button>`).join('') : ''
  const vs = r.vagas.map((v, i) => ({ v, i, ...notaVaga(v, RD.perfil) })).filter(({ v }) => VG_F === 'todas' || v.modalidade === VG_F).sort((a, b) => b.nota - a.nota)
  desenharBuscasVagas(); desenharCandidaturas()
  const nota = $('[data-vg-auto]'); if (nota) nota.textContent = r.auto && r.quando ? `Atualizadas sozinhas em ${new Date(r.quando).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}: o Vynco busca vagas da sua área a cada 3 dias.` : 'O Vynco também busca vagas da sua área sozinho, a cada 3 dias.'
  $('[data-rd-vagas]').innerHTML = (vs.length ? vs.map(cartaoVaga).join('')
    : `<div class="es-vazio glass"><h3>${r.quando ? 'Nada com essas preferências' : 'Nenhuma vaga ainda'}</h3><p>${r.quando ? 'A IA não achou vagas recentes assim. Tente outro local, modalidade ou nível.' : 'Diga onde e como quer trabalhar e clique em "Buscar vagas". A sua IA traz vagas públicas recentes que combinam com a sua área, com o link conferido.'}</p></div>`)
    + (r.maisVagas ? `<a class="link" href="${esc(urlOk(r.maisVagas))}" target="_blank" rel="noopener">Ver mais vagas no LinkedIn ↗</a>` : '')
  aplicarAbas()
}
// a vaga em duas camadas: o essencial à vista (cargo, empresa, etiquetas, por que combina) e o resto em "Ver detalhes"
function cartaoVaga({ v, i, nota, motivos }) {
  const anotada = (RD.candidaturas || []).some(c => c.vaga === v.titulo && c.empresa === (v.empresa || ''))
  const tags = [[v.modalidade, icModo(v.modalidade)], [v.nivel, 'nivel'], [v.contrato, 'contrato']].filter(x => x[0]).map(([t, i]) => `<span class="vg-tag">${icr(i)}${esc(t)}</span>`).join('') + (v.salario ? `<span class="vg-tag money">${icr('dinheiro')}${esc(v.salario)}</span>` : '')
  const lista = (t, xs, cls = '') => xs && xs.length ? `<div class="vg-bloco${cls}"><small>${t}</small><ul>${xs.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''
  const tem = (v.requisitos || []).length || (v.diferenciais || []).length || v.combina || v.falta || v.candidatura
  return `<article class="rd-card vg">
    <header class="vg-h"><span class="vg-logo" aria-hidden="true">${inicial(v.empresa || v.titulo)}</span><span><b>${esc(v.titulo)}</b><small class="rd-meta">${v.empresa ? `${icr('predio')}${esc(v.empresa)}` : ''}${v.local ? `<span>${icr('local')}${esc(v.local)}</span>` : ''}</small></span>${v.publicada ? `<small class="vg-quando">${icr('relogio')}${esc(v.publicada)}</small>` : ''}${anelNota(nota, 'Nota pelo seu perfil e pelo que você procura: da sua área +3, o seu nível +2, a sua modalidade +2, desta semana +1, link conferido +1, mostra o salário +1')}</header>
    ${tags ? `<div class="vg-tags">${tags}</div>` : ''}
    <p>${esc(v.por_que)}</p>
    ${tem ? `<details class="vg-mais"><summary>Ver detalhes</summary>
      ${lista('Requisitos', v.requisitos)}${lista('Diferenciais e benefícios', v.diferenciais)}
      ${v.combina || v.falta ? `<div class="vg-fit">${v.combina ? `<div class="vg-bloco ok"><small>O que você já tem</small><p>${esc(v.combina)}</p></div>` : ''}${v.falta ? `<div class="vg-bloco falta"><small>O que pode faltar</small><p>${esc(v.falta)}</p></div>` : ''}</div>` : ''}
      ${v.candidatura ? `<div class="vg-bloco"><small>Como se candidatar</small><p>${esc(v.candidatura)}</p></div>` : ''}
    </details>` : ''}
    <p class="motivos">${motivos.length ? motivos.map(esc).join(' · ') : 'pouco a ver com o que você procura'}</p>
    <div class="rd-a"><a class="btn sm accent" href="${esc(urlOk(v.link))}" target="_blank" rel="noopener">${icr('externo')}Abrir a vaga${v.fonte ? ' no ' + esc(v.fonte) : ''}</a>${anotada ? `<span class="rd-ok ok">${icr('escudo')}candidatura anotada</span>` : `<button class="btn sm" type="button" data-vg-anota="${i}">${icr('pasta')}Anotar candidatura</button>`}<span class="rd-ok ${v.conferido ? 'ok' : ''}">${v.conferido ? `${icr('escudo')}link conferido` : 'o site não deixa conferir o link'}</span></div></article>`
}
// ---------------------------------------------------------------- abas dentro de Conexões e de Vagas
const RD_TAB = { conexoes: 'sugestoes', vagas: 'vagas' }
function aplicarAbas() {
  if (!RD) return
  const r = RD.rede, n = { sugestoes: r.conexoes.length, convites: (RD.convites || []).length, seguir: (r.seguir || []).length, vagas: r.vagas.length, candidaturas: (RD.candidaturas || []).length }
  for (const nav of $$('[data-rd-tabs]')) {
    const pag = nav.dataset.rdTabs, pagEl = nav.closest('[data-rd-pag]')
    $$('[data-rd-tab]', nav).forEach(b => {
      const v = b.dataset.rdTab, c = $('[data-tn]', b)
      if (c) c.textContent = n[v] || ''
      b.hidden = v === 'seguir' && !n.seguir
      b.setAttribute('aria-selected', String(RD_TAB[pag] === v))
    })
    $$('[data-rd-sec]', pagEl).forEach(sec => { sec.hidden = sec.dataset.rdSec !== RD_TAB[pag] })
  }
}
function irAba(pag, v) { RD_TAB[pag] = v; aplicarAbas() }
document.addEventListener('click', e => { const b = e.target.closest('[data-rd-tab]'); if (!b) return; Som.tique(); irAba(b.closest('[data-rd-tabs]').dataset.rdTabs, b.dataset.rdTab) })
// a nota em anel, no canto do cartão
const anelNota = (n, titulo) => `<span class="nota-anel" style="--p:${n * 10}%;--c:${corNota(n)}" title="${esc(titulo)}" aria-label="Nota ${n} de 10"><b>${n}</b></span>`

// ---------------------------------------------------------------- nota de 0 a 10: o quanto cada tipo de pessoa combina com o seu perfil
// Só lê o texto da sugestão e o seu perfil (nada do LinkedIn). Os pesos somam 10:
// decide contratação +3 · da sua área +2 · é o seu público +2 · abre vagas +2 · fala dos seus temas +1
const semAcento = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const PARAR = new Set(['para', 'com', 'que', 'dos', 'das', 'uma', 'como', 'mais', 'sobre', 'pessoas', 'quem', 'area', 'voce', 'seus', 'suas'])
const palavrasDe = t => [...new Set(semAcento(t).split(/[^a-z0-9]+/).filter(p => p.length >= 4 && !PARAR.has(p)))]
function notaConexao(c, P) {
  const t = semAcento([c.perfil, c.por_que, c.busca].join(' ')), tem = ps => ps.some(p => t.includes(p)), motivos = []
  let n = 0
  if (/recrut|recruit|talent|head|diretor|director|gerente|manager|lider|lead\b|founder|fundador|\bceo\b|socio|owner|coordenador|chief|\bcto\b|\bcmo\b/.test(t)) { n += 3; motivos.push('decide contratação') }
  if (tem(palavrasDe(P.area))) { n += 2; motivos.push('da sua área') }
  if (tem(palavrasDe(P.publico))) { n += 2; motivos.push('é o seu público') }
  if (/contrat|hiring|vagas?\b|recrut|abre(m)? vaga|oportunidade/.test(t)) { n += 2; motivos.push('abre vagas') }
  if (tem(palavrasDe([].concat(P.temas || []).join(' ')))) { n += 1; motivos.push('fala dos seus temas') }
  return { nota: Math.min(10, n), motivos }
}
const corNota = n => n >= 8 ? 'var(--green)' : n >= 5 ? 'var(--amber)' : 'var(--faint)'

// ---------------------------------------------------------------- buscas prontas por tema (abrem a busca de pessoas no LinkedIn; quem decide é você)
function buscasProntas(P) {
  const area = String(P.area || '').split(',')[0].trim().toLowerCase(); if (!area) return []
  const design = /design|ux|ui\b/.test(area), loc = RD_P.local ? ' ' + RD_P.local.trim() : ''
  const temas = [].concat(P.temas || []).map(x => String(x).trim()).filter(Boolean).slice(0, 3)
  return [
    ['Quem contrata', 'alvo', 'decidem ou indicam para vagas', [`recrutador ${area}`, `talent acquisition ${area}`, `head de ${area}`, `gerente de ${area}`, ...(design ? ['diretor de arte', 'creative director', 'design manager'] : [`diretor de ${area}`])]],
    ['Vagas ativas', 'pasta', 'pessoas que anunciaram contratação', [`contratando ${area}`, `hiring ${area}`, `vaga ${area}`, `estamos contratando ${area}`]],
    ['Colegas da área', 'pessoas', 'trocam referências e indicam', [area, ...temas.map(t => `${area} ${t}`), ...(design ? ['product designer', 'ui ux designer'] : [])]],
  ].map(([t, ic, sub, qs]) => [t, ic, sub, [...new Set(qs)].map(q => ({ q, url: 'https://www.linkedin.com/search/results/people/?keywords=' + encodeURIComponent(q + loc) }))])
}
function desenharBuscas() {
  const box = $('[data-rd-buscas]'); if (!box || !RD) return
  const g = buscasProntas(RD.perfil)
  box.hidden = !g.length
  if (!g.length) return
  box.innerHTML = `<header class="rd-h"><h2>${icr('busca')}Buscas prontas</h2><small class="fine">Abrem a busca de pessoas no LinkedIn${RD_P.local ? ` em ${esc(RD_P.local)}` : ''}. Lá, use os filtros (localidade, empresa) e escolha você quem convidar.</small></header>
    <div class="rd-bg">${g.map(([t, ic, sub, qs]) => `<div class="rd-bgrupo"><span class="rd-bt">${icr(ic)}<b>${t}</b><small>${sub}</small></span><div class="chips">${qs.map(x => `<a class="chip-link" href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.q)}${icr('externo', 'icr mini')}</a>`).join('')}</div></div>`).join('')}</div>`
}

// ---------------------------------------------------------------- convites que você mandou (anotados à mão)
let CV_SUG = null, CV_F = 'todos', CD_F = 'todas'
const filtroNum = (attr, atual, itens) => `<div class="cv-num" role="group">${itens.map(([v, n, t]) => `<button type="button" ${attr}="${v}" class="${atual === v ? 'on' : ''}" aria-pressed="${atual === v}"><b>${n}</b>${t}</button>`).join('')}</div>`
const seletor = (attr, atual, ops) => `<span class="cv-sel e-${atual}"><i aria-hidden="true"></i><select ${attr} aria-label="Situação">${ops.map(([v, t]) => `<option value="${v}"${v === atual ? ' selected' : ''}>${t}</option>`).join('')}</select></span>`
const CV_EST = [['enviado', 'Aguardando'], ['aceito', 'Aceitou'], ['sem-resposta', 'Sem resposta'], ['retirado', 'Retirado']]
const diasDesde = q => Math.floor((Date.now() - Date.parse(q)) / 864e5)
function desenharConvites() {
  const box = $('[data-rd-conv]'); if (!box || !RD) return
  const l = RD.convites || [], semana = l.filter(c => diasDesde(c.quando) < 7).length
  const aceitos = l.filter(c => c.estado === 'aceito').length, respondidos = l.filter(c => ['aceito', 'sem-resposta'].includes(c.estado)).length
  const parados = l.filter(c => c.estado === 'enviado' && diasDesde(c.quando) >= 21)
  box.innerHTML = `<header class="rd-h"><h2>${icr('carta')}Convites que você mandou</h2>${l.length ? `<span class="tag">${l.length}</span>` : ''}</header>
    <p class="fine">O Vynco não envia nem lê convites no LinkedIn. Mande lá e anote aqui para acompanhar quem aceitou.</p>
    ${l.length ? filtroNum('data-cv-f', CV_F, [['todos', l.length, 'todos'], ['enviado', l.filter(c => c.estado === 'enviado').length, 'aguardando'], ['aceito', aceitos, `aceitaram${respondidos ? ` · ${Math.round(100 * aceitos / respondidos)}%` : ''}`], ['semana', semana, 'nesta semana']]) : ''}
    ${parados.length ? `<p class="cv-alerta">${icr('relogio')}${parados.length} ${parados.length === 1 ? 'convite está' : 'convites estão'} sem resposta há mais de 3 semanas. Muitos convites parados pesam contra a conta: retire os antigos em <a class="link" href="https://www.linkedin.com/mynetwork/invitation-manager/sent/" target="_blank" rel="noopener">Minha rede → Enviados ↗</a> e marque aqui como "Retirado".</p>` : ''}
    ${semana >= 15 ? '<p class="cv-alerta">O LinkedIn limita quantos convites dá para mandar por semana. Vá com calma: poucos convites, bem escolhidos e com uma nota, rendem mais.</p>' : ''}
    <form class="cv-add" data-cv-add><input name="quem" maxlength="120" autocomplete="off" placeholder="${CV_SUG ? `Para quem você mandou? (${esc(CV_SUG.sugestao)})` : 'Para quem você mandou? Nome ou cargo'}" aria-label="Para quem você mandou o convite"><button class="btn sm accent" type="submit">Anotar convite</button>${l.length ? '<button class="link" type="button" data-cv-csv>Baixar CSV</button>' : ''}</form>
    ${l.length ? `<ul class="cv-lista">${l.filter(c => CV_F === 'todos' || (CV_F === 'semana' ? diasDesde(c.quando) < 7 : c.estado === CV_F)).slice(0, 60).map(c => `<li data-cv="${c.id}"><span class="cv-q"><b>${esc(c.quem)}</b><small>${[c.sugestao, c.nota != null ? 'nota ' + c.nota : '', (d => d < 1 ? 'hoje' : d === 1 ? 'ontem' : 'há ' + d + ' dias')(diasDesde(c.quando))].filter(Boolean).map(esc).join(' · ')}</small></span>
      ${seletor('data-cv-est', c.estado, CV_EST)}<button class="ic-btn" type="button" data-cv-fora title="Apagar da lista" aria-label="Apagar da lista">×</button></li>`).join('')}</ul>` : ''}`
}
async function anotarConv(b) { try { const r = await api('/api/rede/convites', b); RD.convites = r.convites; desenharConvites(); aplicarAbas(); return true } catch (e) { falha(e); return false } }
document.addEventListener('change', e => {
  const a = e.target.closest('[data-cv-est]'), b = e.target.closest('[data-cd-est]')
  if (a) { Som.tique(); anotarConv({ acao: 'estado', id: a.closest('[data-cv]').dataset.cv, estado: a.value }).then(aplicarAbas) }
  if (b) { Som.tique(); anotarCand({ acao: 'estado', id: b.closest('[data-cd]').dataset.cd, estado: b.value }).then(aplicarAbas) }
})
document.addEventListener('submit', async e => {
  if (!e.target.matches('[data-cv-add]')) return
  e.preventDefault()
  const quem = e.target.quem.value.trim() || (CV_SUG ? CV_SUG.sugestao : '')
  if (await anotarConv({ acao: 'add', quem, sugestao: CV_SUG?.sugestao || '', nota: CV_SUG?.nota ?? null })) { CV_SUG = null; Som.tique(); pill('Convite anotado', 'Marque "Aceitou" quando a pessoa aceitar.', 'var(--green)'); desenharConvites() }
})
document.addEventListener('click', async e => {
  const est = e.target.closest('[data-cv-est]'), fora = e.target.closest('[data-cv-fora]'), csv = e.target.closest('[data-cv-csv]'), anota = e.target.closest('[data-rd-anota]')
  const fcv = e.target.closest('[data-cv-f]'); if (fcv) { CV_F = fcv.dataset.cvF; Som.tique(); return desenharConvites() }
  if (fora) return anotarConv({ acao: 'remover', id: fora.closest('[data-cv]').dataset.cv })
  if (anota) {
    const c = RD.rede.conexoes[+anota.dataset.rdAnota]; CV_SUG = { sugestao: c.perfil, nota: notaConexao(c, RD.perfil).nota }
    desenharConvites(); irAba('conexoes', 'convites'); setTimeout(() => $('[data-cv-add] input')?.focus(), 150); return
  }
  if (csv) {
    const linhas = [['quando', 'quem', 'sugestao', 'nota', 'situacao'], ...(RD.convites || []).map(c => [c.quando.slice(0, 10), c.quem, c.sugestao, c.nota ?? '', (CV_EST.find(x => x[0] === c.estado) || [, c.estado])[1]])]
    const blob = new Blob(['\ufeff' + linhas.map(l => l.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `convites-vynco-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }
})

// ---------------------------------------------------------------- vagas: nota de 0 a 10 pelo seu perfil e pelo que você procura
// da sua área +3 · nível que você escolheu +2 · modalidade que você escolheu +2 · publicada nesta semana +1 · link conferido +1 · mostra o salário +1
function recente(p) {
  const t = semAcento(p); if (!t) return false
  if (/hora|minuto|hoje|ontem|today|yesterday|agora/.test(t)) return true
  const m = t.match(/(\d+)\s*(dia|day)/); if (m) return +m[1] <= 7
  const d = Date.parse(p); return !isNaN(d) && Date.now() - d <= 7 * 864e5
}
function notaVaga(v, P) {
  const t = semAcento([v.titulo, v.por_que, v.combina].join(' ')), motivos = []
  let n = 0
  if (palavrasDe(P.area).some(p => t.includes(p))) { n += 3; motivos.push('da sua área') }
  const nivel = semAcento(v.nivel + ' ' + v.titulo), pn = semAcento(RD_P.senioridade)
  if (pn && (nivel.includes(pn) || (pn === 'senior' && /senior|sr\b/.test(nivel)) || (pn === 'lideranca' && /lead|head|gerente|coordenad|lider|manager/.test(nivel)))) { n += 2; motivos.push('o seu nível') }
  if (RD_P.modalidade && semAcento(v.modalidade).includes(semAcento(RD_P.modalidade))) { n += 2; motivos.push(RD_P.modalidade.toLowerCase()) }
  if (recente(v.publicada)) { n += 1; motivos.push('desta semana') }
  if (v.conferido) { n += 1; motivos.push('link conferido') }
  if (v.salario) { n += 1; motivos.push('mostra o salário') }
  return { nota: Math.min(10, n), motivos }
}

// buscas de vagas no LinkedIn com os filtros do próprio site (modalidade, nível e data)
const WT = { Remoto: '2', 'Híbrido': '3', Presencial: '1' }, EXP = { 'Júnior': '2', Pleno: '3', 'Sênior': '4', 'Liderança': '5,6' }
const urlVagas = (q, o = {}) => 'https://www.linkedin.com/jobs/search/?' + new URLSearchParams(Object.entries({ keywords: q, location: o.local || '', f_TPR: o.tempo || '', f_WT: o.wt || '', f_E: o.e || '' }).filter(([, v]) => v)).toString()
function buscasDeVagas(P) {
  const area = String(P.area || '').split(',')[0].trim().toLowerCase(); if (!area) return []
  const design = /design|ux|ui\b/.test(area), local = (RD_P.local || '').trim()
  const prefs = { local, wt: WT[RD_P.modalidade] || '', e: EXP[RD_P.senioridade] || '' }
  const termos = [area, ...(design ? ['product designer', 'ui ux designer'] : []), ...[].concat(P.temas || []).slice(0, 2).map(t => `${area} ${String(t).trim()}`)]
  return [
    ['Com o que você procura', 'alvo', [RD_P.modalidade, RD_P.senioridade, local].filter(Boolean).join(' · ') || 'escolha local, modalidade e nível acima', termos.map(q => ({ q, url: urlVagas(q, { ...prefs, tempo: 'r604800' }) }))],
    ['Publicadas nas últimas 24 horas', 'relogio', 'quem se candidata cedo aparece mais', termos.slice(0, 3).map(q => ({ q, url: urlVagas(q, { ...prefs, tempo: 'r86400' }) }))],
    ['Só remotas', 'casa', 'de qualquer lugar', termos.slice(0, 3).map(q => ({ q, url: urlVagas(q, { e: prefs.e, wt: '2', tempo: 'r604800' }) }))],
  ]
}
function desenharBuscasVagas() {
  const box = $('[data-vg-buscas]'); if (!box || !RD) return
  const g = buscasDeVagas(RD.perfil); box.hidden = !g.length; if (!g.length) return
  box.innerHTML = `<header class="rd-h"><h2>${icr('busca')}Buscas prontas de vagas</h2><small class="fine">Abrem a busca de vagas do LinkedIn já com os filtros. A candidatura é sempre feita por você, no site da vaga.</small></header>
    <div class="rd-bg">${g.map(([t, ic, sub, qs]) => `<div class="rd-bgrupo"><span class="rd-bt">${icr(ic)}<b>${t}</b><small>${esc(sub)}</small></span><div class="chips">${qs.map(x => `<a class="chip-link" href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.q)}${icr('externo', 'icr mini')}</a>`).join('')}</div></div>`).join('')}</div>`
}

// candidaturas que você mandou (anotadas à mão)
const CD_EST = [['enviada', 'Enviada'], ['entrevista', 'Entrevista'], ['proposta', 'Proposta'], ['recusada', 'Recusada'], ['sem-resposta', 'Sem resposta']]
function desenharCandidaturas() {
  const box = $('[data-vg-cand]'); if (!box || !RD) return
  const l = RD.candidaturas || [], n = e => l.filter(c => c.estado === e).length
  const respondidas = l.filter(c => ['entrevista', 'proposta', 'recusada'].includes(c.estado)).length
  const paradas = l.filter(c => c.estado === 'enviada' && diasDesde(c.quando) >= 10)
  const quandoTxt = d => d < 1 ? 'hoje' : d === 1 ? 'ontem' : 'há ' + d + ' dias'
  box.innerHTML = `<header class="rd-h"><h2>${icr('pasta')}Candidaturas que você mandou</h2>${l.length ? `<span class="tag">${l.length}</span>` : ''}</header>
    <p class="fine">O Vynco não se candidata por você. Candidate-se no site da vaga e anote aqui para acompanhar cada uma.</p>
    ${l.length ? filtroNum('data-cd-f', CD_F, [['todas', l.length, `todas · ${Math.round(100 * respondidas / l.length)}% com resposta`], ['enviada', n('enviada'), 'aguardando'], ['entrevista', n('entrevista'), 'em entrevista'], ['proposta', n('proposta'), 'com proposta']]) : ''}
    ${paradas.length ? `<p class="cv-alerta">${icr('relogio')}${paradas.length} ${paradas.length === 1 ? 'candidatura está' : 'candidaturas estão'} sem resposta há mais de 10 dias. Uma mensagem curta e educada para quem recruta pode destravar: diga a vaga, por que você combina e que segue à disposição.</p>` : ''}
    <form class="cv-add" data-cd-add><input name="vaga" maxlength="140" autocomplete="off" placeholder="Vaga (ex.: Product designer pleno)" aria-label="Vaga"><input name="empresa" maxlength="100" autocomplete="off" placeholder="Empresa" aria-label="Empresa"><button class="btn sm accent" type="submit">Anotar candidatura</button>${l.length ? '<button class="link" type="button" data-cd-csv>Baixar CSV</button>' : ''}</form>
    ${l.length ? `<ul class="cv-lista">${l.filter(c => CD_F === 'todas' || c.estado === CD_F).slice(0, 60).map(c => `<li data-cd="${c.id}"><span class="cv-q"><b>${c.link ? `<a class="link" href="${esc(urlOk(c.link))}" target="_blank" rel="noopener">${esc(c.vaga)}</a>` : esc(c.vaga)}</b><small>${[c.empresa, c.nota != null ? 'nota ' + c.nota : '', quandoTxt(diasDesde(c.quando))].filter(Boolean).map(esc).join(' · ')}</small></span>
      ${seletor('data-cd-est', c.estado, CD_EST)}<button class="ic-btn" type="button" data-cd-fora title="Apagar da lista" aria-label="Apagar da lista">×</button></li>`).join('')}</ul>` : ''}`
}
async function anotarCand(b) { try { const r = await api('/api/rede/candidaturas', b); RD.candidaturas = r.candidaturas; desenharCandidaturas(); aplicarAbas(); return true } catch (e) { falha(e); return false } }
document.addEventListener('submit', async e => {
  if (!e.target.matches('[data-cd-add]')) return
  e.preventDefault()
  if (await anotarCand({ acao: 'add', vaga: e.target.vaga.value.trim(), empresa: e.target.empresa.value.trim() })) { Som.tique(); pill('Candidatura anotada', 'Atualize a situação quando tiver resposta.', 'var(--green)') }
})
document.addEventListener('click', async e => {
  const est = e.target.closest('[data-cd-est]'), fora = e.target.closest('[data-cd-fora]'), csv = e.target.closest('[data-cd-csv]'), anota = e.target.closest('[data-vg-anota]')
  const fcd = e.target.closest('[data-cd-f]'); if (fcd) { CD_F = fcd.dataset.cdF; Som.tique(); return desenharCandidaturas() }
  if (fora) return anotarCand({ acao: 'remover', id: fora.closest('[data-cd]').dataset.cd })
  if (anota) {
    const v = RD.rede.vagas[+anota.dataset.vgAnota]
    if ((RD.candidaturas || []).some(c => c.vaga === v.titulo && c.empresa === (v.empresa || ''))) return pill('Já anotada', 'Essa candidatura já está na sua lista.', 'var(--amber)')
    if (await anotarCand({ acao: 'add', vaga: v.titulo, empresa: v.empresa || '', link: v.link || '', nota: notaVaga(v, RD.perfil).nota })) { Som.liga(); pill('Candidatura anotada', 'Boa! Ela está em "Candidaturas que você mandou".', 'var(--green)'); desenharRede() }
    return
  }
  if (csv) {
    const linhas = [['quando', 'vaga', 'empresa', 'nota', 'situacao', 'link'], ...(RD.candidaturas || []).map(c => [c.quando.slice(0, 10), c.vaga, c.empresa, c.nota ?? '', (CD_EST.find(x => x[0] === c.estado) || [, c.estado])[1], c.link])]
    const blob = new Blob(['\ufeff' + linhas.map(l => l.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `candidaturas-vynco-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }
})

async function buscarRede(tipo) {
  RD_P.local = $('[data-rd=local]').value
  try { await api('/api/rede/buscar', { tipo, ...RD_P }); RD.estado = { estado: 'rodando', tipo }; humor('work'); Som.tique(); desenharRede(); acompanharRede() } catch (e) { falha(e) }
}
function acompanharRede() {
  clearTimeout(rdT)
  rdT = setTimeout(async () => {
    let r; try { r = await api('/api/rede') } catch { return acompanharRede() }
    const era = RD.estado?.estado; RD = r
    if (r.estado?.estado === 'rodando') { if (atual?.dataset.scene === 'rede') desenharRede(); return acompanharRede() }
    if (era === 'rodando') { r.estado?.estado === 'pronto' ? (Som.liga(), pill('Sugestões prontas', 'Veja as conexões e as vagas na aba Rede.', 'var(--green)')) : (Som.erro(), pill('A busca não deu certo', r.estado?.erro || '', 'var(--red)')) }
    atualizarHumor(); if (atual?.dataset.scene === 'rede') desenharRede()
  }, DEMO ? 800 : 3000)
}
$('[data-scene=rede]').addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b) return
  if (b.closest('[data-rd-chips]')) { const k = b.closest('[data-rd-chips]').dataset.rdChips; RD_P[k] = RD_P[k] === b.dataset.v ? '' : b.dataset.v; Som.tique(); return desenharRede() }
  if (b.dataset.rdIr) return buscarRede(b.dataset.rdIr)
  if (b.dataset.vgF) { VG_F = b.dataset.vgF; Som.tique(); return desenharRede() }
  if (b.dataset.rdCopia != null) { try { await navigator.clipboard.writeText(RD.rede.conexoes[+b.dataset.rdCopia].convite); Som.tique(); pill('Convite copiado', 'Cole na mensagem do convite no LinkedIn.', 'var(--green)') } catch { pill('Não consegui copiar', '', 'var(--amber)') } }
})
