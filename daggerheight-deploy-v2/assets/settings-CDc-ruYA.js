import{c as e,f as t,g as n,i as r,n as i,r as a,s as o,t as s,u as c}from"./i18n-CoR24Jgs.js";import{a as l,t as u}from"./theme-DEJojdpE.js";var d=c(`settings-modal`);function f(e){return e<=50?.5+e/50*.5:1+(e-50)/50*1}function p(e){return e<=1?(e-.5)/.5*50:50+(e-1)/1*50}var m=[{id:`LEFT`,labelKey:`positionLeft`},{id:`RIGHT`,labelKey:`positionRight`},{id:`TOP`,labelKey:`positionTop`},{id:`BOTTOM`,labelKey:`positionBottom`}];function h(r){let{language:a}=r,c=document.querySelector(`#app`);c.innerHTML=`
    <h1 class="settings-title">${i(a,`settingsTitle`)}</h1>

    <label class="settings-label" for="language-select">${i(a,`settingsLanguage`)}</label>
    <select class="select-input" id="language-select">
      ${s.map(e=>`<option value="${e.id}" ${e.id===r.language?`selected`:``}>${i(a,e.labelKey)}</option>`).join(``)}
    </select>

    <label class="settings-label">${i(a,`settingsIconSize`)}</label>
    <div class="settings-row">
      <input type="range" id="icon-size" min="0" max="100" step="1" value="${p(r.iconSize)}" />
      <span id="icon-size-value">${r.iconSize.toFixed(1)}x</span>
    </div>

    <label class="settings-label">${i(a,`settingsColors`)}</label>
    <div class="settings-row colors-row">
      ${t.map(e=>`
          <label class="color-swatch">
            <input type="color" data-rank="${e.id}" value="${r.colors[e.id]}" />
            <span>${i(a,e.labelKey)}</span>
          </label>
        `).join(``)}
    </div>

    <label class="settings-label">${i(a,`settingsPosition`)}</label>
    <div class="settings-row" id="position-row">
      ${m.map(e=>`<button class="choice-button" data-value="${e.id}">${i(a,e.labelKey)}</button>`).join(``)}
    </div>

    <div class="settings-actions">
      <button class="secondary-button" id="cancel-button">${i(a,`cancel`)}</button>
      <button class="primary-button" id="save-button">${i(a,`save`)}</button>
    </div>
  `;function u(e,t){e.querySelectorAll(`.choice-button`).forEach(e=>{e.classList.toggle(`selected`,e.dataset.value===t)})}let g=document.getElementById(`position-row`);u(g,r.position);let _=document.getElementById(`language-select`);_.addEventListener(`change`,()=>{r.language=_.value,h(r)}),g.querySelectorAll(`.choice-button`).forEach(e=>{e.addEventListener(`click`,()=>{r.position=e.dataset.value,u(g,r.position)})});let v=document.getElementById(`icon-size`),y=document.getElementById(`icon-size-value`);v.addEventListener(`input`,()=>{r.iconSize=f(parseFloat(v.value)),y.textContent=`${r.iconSize.toFixed(1)}x`}),document.querySelectorAll(`input[type="color"]`).forEach(e=>{e.addEventListener(`input`,()=>{let t=e.dataset.rank;r.colors[t]=e.value})}),document.getElementById(`cancel-button`).addEventListener(`click`,()=>{n.modal.close(d)}),document.getElementById(`save-button`).addEventListener(`click`,async()=>{let t={iconSize:r.iconSize,colors:r.colors,position:r.position};await Promise.all([e(t),o(r.language)]),await l(t),n.modal.close(d)})}async function g(){let[e,t]=await Promise.all([a(),r()]);h({language:e,position:t.position,colors:{...t.colors},iconSize:t.iconSize})}n.onReady(()=>{u(),g()});