(() => {
  const dialog = document.querySelector('#reel-dialog');
  const reel = dialog?.querySelector('video');
  document.querySelector('#open-reel')?.addEventListener('click', () => { dialog.showModal(); reel.play().catch(() => {}); });
  document.querySelector('#close-reel')?.addEventListener('click', () => dialog.close());
  dialog?.addEventListener('close', () => { reel.pause(); });
  dialog?.addEventListener('click', (event) => { if (event.target === dialog) { const bounds = dialog.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close(); } });

  const gameList = document.querySelector('#game-list');
  if (gameList) {
    let controls = document.querySelector('.library-controls');
    if (!controls) {
      controls = document.createElement('div'); controls.className = 'library-controls';
      controls.innerHTML = '<label class="game-search"><span aria-hidden="true">⌕</span><input type="search" id="game-search" placeholder="플레이한 게임 검색" aria-label="게임 이름 검색"></label><span id="game-count" role="status"></span>';
      gameList.before(controls);
    }
    let more = document.querySelector('#show-more-games');
    if (!more) { more = document.createElement('button'); more.type = 'button'; more.id = 'show-more-games'; more.className = 'library-more'; gameList.after(more); }
    let empty = document.querySelector('#game-empty');
    if (!empty) { empty = document.createElement('p'); empty.id = 'game-empty'; empty.className = 'game-empty'; empty.textContent = '검색 결과가 없습니다. 다른 게임 이름을 입력해 주세요.'; gameList.after(empty); }
    let expanded = false;
    const input = controls.querySelector('input');
    input.value = '';
    const filterGames = () => {
      const cards = [...gameList.querySelectorAll('.game-card')];
      const editing = document.body.classList.contains('is-editing');
      const query = input.value.trim().toLocaleLowerCase();
      const matching = cards.filter(card => card.querySelector('h3')?.textContent.toLocaleLowerCase().includes(query));
      cards.forEach(card => { card.hidden = !editing && (!matching.includes(card) || (!expanded && !query && matching.indexOf(card) >= 6)); });
      controls.querySelector('#game-count').textContent = query ? `${matching.length}개 검색됨` : `${cards.length}개의 플레이 기록`;
      empty.hidden = editing || matching.length > 0;
      more.hidden = editing || !!query || matching.length <= 6;
      more.textContent = expanded ? '간략히 보기 ↑' : `전체 ${matching.length}개 게임 보기 ↓`;
    };
    input.addEventListener('input', filterGames);
    more.addEventListener('click', () => { expanded = !expanded; filterGames(); if (!expanded) controls.scrollIntoView({ block: 'center' }); });
    document.addEventListener('portfolio:edit-change', filterGames);
    new MutationObserver(filterGames).observe(gameList, { childList: true });
    filterGames();
  }

  const updateDrafts = () => {
    document.querySelectorAll('#portfolio-grid > .case-card').forEach(card => {
      const title = card.querySelector('h2')?.textContent.trim();
      card.classList.toggle('is-draft', title === '새 포트폴리오');
      card.querySelectorAll('.case-file').forEach(file => file.classList.toggle('is-empty', !file.querySelector('.case-file-value')?.textContent.trim()));
    });
  };
  document.addEventListener('portfolio:edit-change', updateDrafts);
  updateDrafts();
  document.querySelectorAll('#portfolio-grid .case-link[href="#"]').forEach(link => {
    const title = link.closest('.case-card').querySelector('h2')?.textContent || '';
    if (title.includes('까미')) { link.href = '#resume'; link.textContent = '프로젝트 경험 보기 ↗'; link.dataset.markdown = link.textContent; }
    if (title.includes('AI 데이터')) { link.href = '#resume'; link.textContent = '활용 기술과 이력 보기 ↗'; link.dataset.markdown = link.textContent; }
  });
  document.querySelectorAll('#portfolio-grid .case-link[href^="https:"]').forEach(link => { link.target = '_blank'; link.rel = 'noopener noreferrer'; });
  document.querySelectorAll('img').forEach(img => img.addEventListener('error', () => { img.classList.add('image-unavailable'); }));
  document.addEventListener('portfolio:view-change', () => { if (dialog.open) dialog.close(); });
})();
