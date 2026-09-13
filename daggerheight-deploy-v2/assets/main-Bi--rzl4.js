import{a as e,d as t,f as n,g as r,h as i,i as a,m as o,n as s,r as c,u as l}from"./i18n-CoR24Jgs.js";import{i as u,n as d,r as f,t as p}from"./theme-DEJojdpE.js";async function m(){let[e,u]=await Promise.all([c(),a()]),d=document.querySelector(`#app`);d.innerHTML=`
    <table class="altitude-table">
      <thead>
        <tr>
          <th></th>
          ${n.map(t=>`<th>${s(e,t.labelKey)}</th>`).join(``)}
        </tr>
      </thead>
      <tbody>
        ${t.map(t=>`
            <tr>
              <th>${s(e,t.labelKey)}</th>
              ${n.map(n=>`
                  <td>
                    <button
                      class="rank-button"
                      id="${o(n.id,t.id)}"
                      data-rank="${n.id}"
                      data-direction="${t.id}"
                      title="${s(e,n.labelKey)} · ${s(e,t.labelKey)}"
                    >
                      ${i(n.count,t.id,u.colors[n.id])}
                    </button>
                  </td>
                `).join(``)}
            </tr>
          `).join(``)}
      </tbody>
    </table>
    <div class="actions">
      <button class="clear-button">${s(e,`clear`)}</button>
      <button class="settings-button" title="${s(e,`settings`)}">⚙</button>
    </div>
  `,document.querySelectorAll(`.rank-button`).forEach(e=>{e.addEventListener(`click`,()=>{let t=e.dataset.rank,n=e.dataset.direction;h(t,n,u)})}),document.querySelector(`.clear-button`).addEventListener(`click`,g),document.querySelector(`.settings-button`).addEventListener(`click`,()=>{r.modal.open({id:l(`settings-modal`),url:`/settings.html`,width:340,height:460})}),await _()}async function h(e,t,i){let a=n.find(t=>t.id===e),o=await r.player.getSelection();if(!a||!o||o.length===0)return;let[s,c,l]=await Promise.all([r.scene.items.getItems(o),f(),r.scene.grid.getDpi()]),p=[],m=[];for(let n of s){let r=c.filter(e=>e.attachedTo===n.id);p.push(...r.map(e=>e.id)),r.some(n=>{let r=u(n);return r?.rank===e&&r.direction===t})||m.push(d(n,a,t,l,i))}p.length>0&&await r.scene.items.deleteItems(p),m.length>0&&await r.scene.items.addItems(m)}async function g(){let e=await r.player.getSelection();if(!e||e.length===0)return;let t=(await f()).filter(t=>t.attachedTo&&e.includes(t.attachedTo)).map(e=>e.id);t.length>0&&await r.scene.items.deleteItems(t)}async function _(){let e=await r.player.getSelection();if(document.querySelectorAll(`.rank-button`).forEach(e=>e.classList.remove(`active`)),!e||e.length===0)return;let t=await f();for(let n of t){if(!n.attachedTo||!e.includes(n.attachedTo))continue;let t=u(n);t&&document.getElementById(o(t.rank,t.direction))?.classList.add(`active`)}}r.onReady(()=>{p(),m(),r.scene.items.onChange(_),e(()=>m())});