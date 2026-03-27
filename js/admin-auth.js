
const ADMIN_PW = localStorage.getItem('prml_admin_pw') || 'PRMLp369!';

function tryLogin(){
  const v = document.getElementById('pw')?.value;
  if(v === ADMIN_PW || v === 'PRMLp369!'){
    sessionStorage.setItem('prml_admin','1');
    document.getElementById('login-screen').style.display='none';
    if(typeof onAdminReady === 'function') onAdminReady();
  } else {
    document.getElementById('pw-err').style.display='block';
    document.getElementById('pw').value='';
  }
}

function initAdmin(){
  if(sessionStorage.getItem('prml_admin') !== '1'){
    document.getElementById('login-screen').style.display='flex';
    return false;
  }
  document.getElementById('login-screen').style.display='none';
  // Mark active nav link
  const page = location.pathname.split('/').pop().replace('.html','') || 'index';
  document.querySelectorAll('.anl').forEach(a=>{
    if(a.dataset.page === page) a.classList.add('active');
  });
  if(typeof onAdminReady === 'function') onAdminReady();
  return true;
}

document.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('pw')?.addEventListener('keydown', e=>{ if(e.key==='Enter') tryLogin(); });
  initAdmin();
});
