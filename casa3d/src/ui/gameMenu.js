export function createGameMenu(root,player,toggle,options={}){
  const dialog=document.createElement('dialog');dialog.className='game-menu';
  dialog.innerHTML='<p class="menu-eyebrow">ANIMAL HOUSE · ESPLORAZIONE</p><h2>Prenditi il tuo tempo.</h2><p>Una magione sospesa tra le stelle.</p><button class="resume-button" autofocus>Riprendi l’esplorazione</button>';
  if(options.description)dialog.querySelector('h2 + p').textContent=options.description;
  const help=document.createElement('dialog');help.className='game-menu';help.setAttribute('aria-labelledby','game-help-title');
  help.innerHTML='<p class="menu-eyebrow">ANIMAL HOUSE · COMANDI</p><h2 id="game-help-title">Come si gioca</h2><div class="control-guide"><p><kbd>W A S D</kbd> o frecce per muoverti · <kbd>Shift</kbd> per correre.</p><p>Tieni premuto il tasto destro e muovi il mouse per guardarti attorno.</p><p>Per tutte le azioni, avvicinati all’oggetto e premi <kbd>E</kbd>, oppure cliccaci sopra.</p><p>Su touch: leva a sinistra per muoverti, trascina a destra per guardare e tocca gli oggetti per interagire.</p></div><button class="resume-button" autofocus>Ho capito</button>';
  const helpButton=document.createElement('button');helpButton.type='button';helpButton.className='help-toggle';
  helpButton.textContent='?';helpButton.setAttribute('aria-label','Comandi e interazioni');helpButton.title='Comandi e interazioni';
  toggle.after(helpButton);root.append(dialog,help);
  function closeModal(modal){modal.close();window.__APP.inputBlocked=false;window.dispatchEvent(new Event('clearinput'));}
  function openModal(modal){if(window.__APP.inputBlocked)return;window.dispatchEvent(new Event('clearinput'));player.velocity.set(0,0,0);window.__APP.inputBlocked=true;modal.showModal();}
  function close(){closeModal(dialog);}
  function open(){openModal(dialog);}
  toggle.addEventListener('click',open);helpButton.addEventListener('click',()=>openModal(help));
  for(const modal of [dialog,help]){
    modal.querySelector('button').addEventListener('click',()=>closeModal(modal));
    modal.addEventListener('cancel',event=>{event.preventDefault();closeModal(modal);});
  }
  document.addEventListener('keydown',event=>{if(event.code==='Escape'&&!dialog.open&&!help.open&&!window.__APP.inputBlocked){event.preventDefault();open();}});
  return {open,close,openHelp:()=>openModal(help)};
}
