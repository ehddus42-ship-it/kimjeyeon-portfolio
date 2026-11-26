(() => {
  const gameList = document.querySelector('#game-list');
  if (gameList) {
    const featuredGames = [
      { name: 'Palworld / 팰월드', mechanics: '팰 포획 · 거점 생산' },
      { name: 'Valheim', mechanics: '협동 생존 · 건축' },
      { name: 'Terraria', mechanics: '탐험 · 제작 · 보스 진행' },
      { name: 'Core Keeper', mechanics: '채굴 · 제작 · 거점 성장' },
      { name: "Don't Starve Together", mechanics: '협동 생존 · 자원 관리' },
      { name: 'ARK: Survival Evolved', mechanics: '길들이기 · 거점 건설' },
    ];
    const getGameName = (card) => card.querySelector('h3')?.textContent.trim();
    const findFeaturedCards = () => {
      const cards = new Map([...gameList.querySelectorAll('.game-card')].map(card => [getGameName(card), card]));
      return featuredGames.map(game => ({ ...game, card: cards.get(game.name) })).filter(game => game.card);
    };
    if (gameList.dataset.gameLibrarySaved !== 'true') {
      gameList.prepend(...findFeaturedCards().map(game => game.card));
    }

    const featuredSection = document.querySelector('.featured-play');
    const featuredList = featuredSection?.querySelector('.featured-play-list');
    const syncFeaturedGames = () => {
      if (!featuredList) return;
      const items = findFeaturedCards().flatMap(({ name, mechanics, card }) => {
        const hours = card.querySelector('.game-details')?.textContent.match(/([\d,.]+)\s*시간/)?.[1];
        if (!hours) return [];
        const item = document.createElement('li');
        const title = document.createElement('strong');
        const record = document.createElement('span');
        const detail = document.createElement('small');
        title.textContent = name;
        record.textContent = `${hours}시간`;
        detail.textContent = mechanics;
        item.append(title, record, detail);
        return [item];
      });
      featuredList.replaceChildren(...items);
      featuredSection.hidden = items.length === 0;
    };
    document.addEventListener('portfolio:edit-change', syncFeaturedGames);
    new MutationObserver(syncFeaturedGames).observe(gameList, { childList: true, subtree: true, characterData: true });
    syncFeaturedGames();

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
})();

// Landing hooks: scroll reveal, scoreboard count-up, email copy.
(() => {
  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const counters = [...document.querySelectorAll('[data-count]')];
  const format = (el, value) => {
    const digits = +el.dataset.decimals || 0;
    return value.toLocaleString('ko-KR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  };
  const settle = (el) => { el.textContent = format(el, +el.dataset.count); };
  // The cover's play-record numbers are derived from the resume's game list,
  // so editing that list keeps the hook figures truthful.
  const gameList = document.querySelector('#game-list');
  const genres = { '이터널 리턴': '배틀로얄 · MOBA', '톰 클랜시의 레인보우식스 시즈': '택티컬 FPS', 'Shadowverse: Worlds Beyond': '카드 배틀', 'PUBG: BATTLEGROUNDS': '배틀로얄', 'Palworld / 팰월드': '생존 · 크래프팅' };
  const syncPlayLog = () => {
    if (!gameList) return;
    const games = [...gameList.querySelectorAll('.game-card')].map((card) => {
      const hours = card.querySelector('.game-details')?.textContent.match(/([\d,]+(?:\.\d+)?)\s*시간/);
      return { name: card.querySelector('h3')?.textContent.trim() || '', hours: hours ? parseFloat(hours[1].replace(/,/g, '')) : 0 };
    }).filter((game) => game.name && game.name !== '새 게임');
    if (!games.length) return;
    const total = Math.floor(games.reduce((sum, game) => sum + game.hours, 0));
    document.querySelectorAll('[data-play-total]').forEach((el) => {
      if (el.dataset.count) el.dataset.count = total;
      el.textContent = total.toLocaleString('ko-KR');
    });
    document.querySelectorAll('[data-play-count]').forEach((el) => { el.textContent = games.length; });
    const top = games.filter((game) => game.hours > 0).sort((a, b) => b.hours - a.hours).slice(0, 5);
    if (!top.length) return;
    document.querySelectorAll('[data-play-top-name]').forEach((el) => { el.textContent = top[0].name; });
    document.querySelectorAll('[data-play-top-hours]').forEach((el) => { el.textContent = Math.round(top[0].hours).toLocaleString('ko-KR'); });
    const bars = document.querySelector('[data-play-top]');
    if (!bars) return;
    bars.replaceChildren(...top.map((game, index) => {
      const item = document.createElement('li');
      const add = (className, text) => { const span = document.createElement('span'); span.className = className; span.textContent = text; item.append(span); return span; };
      add('play-rank', String(index + 1).padStart(2, '0'));
      const name = add('play-name', game.name);
      if (genres[game.name]) { const genre = document.createElement('small'); genre.textContent = genres[game.name]; name.append(genre); }
      add('play-hours', Math.round(game.hours).toLocaleString('ko-KR') + 'h');
      const bar = add('play-bar', '');
      bar.setAttribute('aria-hidden', 'true');
      const fill = document.createElement('i');
      fill.style.setProperty('--w', (game.hours / top[0].hours * 100).toFixed(1) + '%');
      bar.append(fill);
      return item;
    }));
  };
  syncPlayLog();
  document.addEventListener('portfolio:edit-change', syncPlayLog);
  const countUp = (el) => {
    const target = +el.dataset.count, started = performance.now(), duration = 1100;
    const tick = (now) => {
      const t = Math.min(1, (now - started) / duration);
      el.textContent = format(el, target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) requestAnimationFrame(tick); else settle(el);
    };
    requestAnimationFrame(tick);
  };

  if ('IntersectionObserver' in window && !reduced) {
    root.classList.add('has-reveal');
    const reveal = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      reveal.unobserve(entry.target);
    }), { rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('[data-reveal]').forEach((el) => reveal.observe(el));
    document.addEventListener('portfolio:view-change', (event) => {
      const viewId = event.detail?.viewId;
      const scope = viewId === 'home' ? document.querySelector('#home') : document.getElementById(viewId);
      scope?.querySelectorAll('[data-reveal]').forEach((el) => {
        el.classList.add('is-in');
        reveal.unobserve(el);
      });
    });
    const board = document.querySelector('.scoreboard');
    if (board) {
      const counting = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        counting.disconnect();
        counters.forEach(countUp);
      }, { threshold: .4 });
      counting.observe(board);
    }
  }

  // Hero featured build switcher.
  document.querySelectorAll('[data-showcase]').forEach((showcase) => {
    const tabs = [...showcase.querySelectorAll('[data-showcase-tab]')];
    const panels = [...showcase.querySelectorAll('[data-showcase-panel]')];
    const select = (index) => {
      tabs.forEach((tab) => {
        const active = tab.dataset.showcaseTab === String(index);
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', String(active));
      });
      panels.forEach((panel) => {
        const active = panel.dataset.showcasePanel === String(index);
        panel.classList.toggle('is-active', active);
        panel.hidden = !active;
      });
    };
    tabs.forEach((tab) => tab.addEventListener('click', () => select(tab.dataset.showcaseTab)));
  });

  // ZeroGate key-visual / lobby level image toggle.
  document.querySelectorAll('[data-zg-gallery]').forEach((gallery) => {
    const buttons = [...gallery.querySelectorAll('[data-zg-btn]')];
    const images = [...gallery.querySelectorAll('[data-zg-img]')];
    const show = (key) => {
      buttons.forEach((btn) => btn.classList.toggle('is-active', btn.dataset.zgBtn === key));
      images.forEach((img) => { img.hidden = img.dataset.zgImg !== key; });
    };
    buttons.forEach((btn) => btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      show(btn.dataset.zgBtn);
    }));
  });

  // Ensure cross-view anchor jumps work reliably even when the hash is unchanged.
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', () => {
      const targetId = link.getAttribute('href').slice(1);
      if (!targetId || window.location.hash !== '#' + targetId) return;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
  });

  // Keep runtime animation state out of the file written by "현재 파일에 적용".
  document.addEventListener('portfolio:before-save', (event) => {
    const saved = event.detail?.document;
    if (!saved) return;
    saved.classList.remove('has-reveal');
    saved.querySelectorAll('.is-in').forEach((el) => el.classList.remove('is-in'));
    saved.querySelectorAll('[data-count]').forEach(settle);
    saved.querySelectorAll('[data-copy-email]').forEach((button) => { button.textContent = '이메일 복사'; });
    saved.querySelectorAll('[data-showcase]').forEach((showcase) => {
      showcase.querySelectorAll('[data-showcase-tab]').forEach((tab, idx) => {
        tab.classList.toggle('is-active', idx === 0);
        tab.setAttribute('aria-selected', String(idx === 0));
      });
      showcase.querySelectorAll('[data-showcase-panel]').forEach((panel, idx) => {
        panel.classList.toggle('is-active', idx === 0);
        panel.hidden = idx !== 0;
      });
    });
    saved.querySelectorAll('[data-zg-gallery]').forEach((gallery) => {
      gallery.querySelectorAll('[data-zg-btn]').forEach((btn, idx) => btn.classList.toggle('is-active', idx === 0));
      gallery.querySelectorAll('[data-zg-img]').forEach((img, idx) => { img.hidden = idx !== 0; });
    });
  });

  document.querySelectorAll('[data-copy-email]').forEach((button) => {
    button.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(button.dataset.copyEmail); button.textContent = '복사됨 ✓'; }
      catch { button.textContent = button.dataset.copyEmail; }
      window.setTimeout(() => { button.textContent = '이메일 복사'; }, 1600);
    });
  });
})();
