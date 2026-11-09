/* Classic bootstrap: file:// can display useful guidance even when the
 * browser refuses ES module imports. No study records are stored here. */
(() => {
  const root = document.getElementById('app');
  const notice = document.getElementById('notice');
  function explain(title, text) {
    const section = document.createElement('section');
    section.className = 'identity panel';
    const heading = document.createElement('h1');
    heading.textContent = title;
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    const link = document.createElement('a');
    link.href = 'http://127.0.0.1:8766/';
    link.textContent = '로컬 실행 화면 열기';
    const hint = document.createElement('p');
    hint.className = 'muted';
    hint.textContent = '먼저 Planner 폴더의 실행하기.bat를 더블클릭하세요. 켜진 서버 창은 사용하는 동안 열어 두세요.';
    section.append(heading, paragraph, link, hint);
    root.replaceChildren(section);
    notice.textContent = '';
  }
  if (location.protocol === 'file:') {
    explain('실행하기.bat로 열어 주세요', 'index.html을 직접 열면 브라우저가 모듈 실행을 차단합니다. Vercel 없이도 로컬 서버로 사용할 수 있습니다.');
    return;
  }
  const scriptUrl = new URL('./app.js', document.currentScript.src);
  const timer = setTimeout(() => {
    if (!document.documentElement.dataset.appReady) explain('파일을 불러오는 중입니다', '연결이 지연되고 있습니다. 페이지를 새로고침하거나 로컬 서버가 켜져 있는지 확인하세요.');
  }, 15000);
  import(scriptUrl.href).catch(() => {
    explain('앱 파일을 불러오지 못했습니다', '페이지를 새로고침해 주세요. 로컬 사용 시 web 폴더의 파일을 함께 유지해야 합니다.');
  }).finally(() => clearTimeout(timer));
})();
