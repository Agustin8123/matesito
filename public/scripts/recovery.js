(() => {
 let token = '';
 const start=document.getElementById('recoveryStart'), reset=document.getElementById('recoveryReset'), result=document.getElementById('recoveryResult');
 async function request(path,body){return fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(readResponse);}
 start.addEventListener('submit',async event=>{
  event.preventDefault();const button=start.querySelector('button');button.disabled=true;result.textContent='';
  try {
   const data=await request('/api/recovery/questions',{username:document.getElementById('recoveryUsername').value});token=data.token;
   const fields=document.getElementById('recoveryQuestions');fields.replaceChildren();
   data.questions.forEach((question,i)=>{const label=document.createElement('label');label.textContent=question;label.htmlFor='answer'+i;const input=document.createElement('input');input.id='answer'+i;input.type='password';input.autocomplete='off';input.required=true;input.minLength=2;input.maxLength=200;const card=document.createElement('fieldset');card.className='recovery-question-card';const legend=document.createElement('legend');legend.textContent='Pregunta '+(i+1);card.append(legend,label,input);fields.append(card);});
   start.hidden=true;reset.hidden=false;document.getElementById('recoveryStep1').removeAttribute('aria-current');document.getElementById('recoveryStep2').setAttribute('aria-current','step');fields.querySelector('input').focus();
  }catch(error){result.textContent=error.message;}finally{button.disabled=false;}
 });
 reset.addEventListener('submit',async event=>{
  event.preventDefault();const button=reset.querySelector('button');
  const newPassword=document.getElementById('resetPassword').value;
  if(newPassword!==document.getElementById('resetConfirm').value){result.textContent='Las contraseñas no coinciden.';return;}
  button.disabled=true;
  try {
   const data=await request('/api/recovery/reset',{token,answers:[0,1,2].map(i=>document.getElementById('answer'+i).value),newPassword});
   token='';reset.reset();reset.hidden=true;result.textContent=data.message;
  }catch(error){result.textContent=error.message;}finally{button.disabled=false;}
 });
 document.getElementById('recoveryRestart').addEventListener('click',()=>{token='';reset.reset();reset.hidden=true;start.hidden=false;document.getElementById('recoveryStep2').removeAttribute('aria-current');document.getElementById('recoveryStep1').setAttribute('aria-current','step');result.textContent='';document.getElementById('recoveryUsername').focus();});
})();
