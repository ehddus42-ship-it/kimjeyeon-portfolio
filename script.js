
    (function () {
      const tabs = Array.from(document.querySelectorAll('.view-tab[data-view]'));
      const panels = Array.from(document.querySelectorAll('.view'));
      const landingPageLinks = Array.from(document.querySelectorAll('[data-page-target]'));
      const coverHomeLinks = Array.from(document.querySelectorAll('[data-cover-home]'));
      const pageMenu = document.getElementById('page-menu');
      const editToggle = document.getElementById('edit-toggle');
      const editableSelector = [
        '.landing-cover h1', '.landing-cover h2', '.landing-cover h3', '.landing-cover p:not(.eyebrow)',
        '.view h1', '.view h2', '.view h3', '.view p:not(.game-details):not(.card-label):not(.eyebrow):not(.meta-label):not(.case-file)', '.view dt', '.view dd',
        '.view .project-number', '.view .project-meta span', '.view .section-heading > span',
        '.view .game-image span', '.view .tool-name', '.view .tool-level', '.view .chip',
        '.view .case-copy h2', '.footer span', '[data-editable="true"]'
      ].join(',');
      const addTool = document.getElementById('add-tool');
      const addGame = document.getElementById('add-game');
      const addPortfolio = document.getElementById('add-portfolio');
      const applyChanges = document.getElementById('apply-changes');
      const editStatus = document.getElementById('edit-status');
      const imageUploadInput = document.getElementById('image-upload-input');
      const fileUploadInput = document.getElementById('file-upload-input');
      const documentViewerFrame = document.getElementById('document-viewer-frame');
      const documentViewerName = document.getElementById('document-viewer-name');
      const documentViewerDirect = document.getElementById('document-viewer-direct');
      const reorderableSelector = '.project-card, .tool, .game-card, .essay-card, .case-card, .landing-project, .landing-highlight';
      let pendingImageSlot = null;
      let pendingFileSlot = null;
      const routeNames = new Set(['home', 'resume', 'cover-letter', 'portfolio', 'updates']);

      function announce(name, detail) {
        document.dispatchEvent(new CustomEvent(name, { bubbles: true, detail }));
      }

      function getEditableNodes() {
        return Array.from(document.querySelectorAll(editableSelector)).filter((node) => !node.closest('#updates'));
      }

      function allowedHref(href) {
        if (href.startsWith('#')) return href;
        try {
          const url = new URL(href, window.location.href);
          return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? href : null;
        } catch (error) {
          return null;
        }
      }

      function readEditorSource(node) {
        let source = '';
        const isBlock = (child) =>
          child.nodeType === Node.ELEMENT_NODE &&
          ['DIV', 'P', 'LI'].includes(child.tagName);
        const isPlaceholderBlock = (child) =>
          isBlock(child) &&
          (
            child.childNodes.length === 0 ||
            (
              child.childNodes.length === 1 &&
              child.firstChild.nodeType === Node.ELEMENT_NODE &&
              child.firstChild.tagName === 'BR'
            )
          );
        const appendLineBreak = () => {
          if (!source.endsWith('\n')) source += '\n';
        };
        function visitChildren(parent) {
          const children = Array.from(parent.childNodes);
          children.forEach((child, index) => {
            const previous = children[index - 1];
            if (
              index > 0 &&
              (isBlock(child) || isBlock(previous)) &&
              !source.endsWith('\n')
            ) {
              appendLineBreak();
            }
            if (child.nodeType === Node.TEXT_NODE) {
              source += child.nodeValue;
              return;
            }
            if (child.nodeType !== Node.ELEMENT_NODE) return;
            if (child.tagName === 'BR') {
              source += '\n';
              return;
            }
            if (isPlaceholderBlock(child)) {
              appendLineBreak();
              return;
            }
            visitChildren(child);
          });
        }
        visitChildren(node);
        return source;
      }

      function renderMarkdown(node, source) {
        const fragment = document.createDocumentFragment();
        const tokenPattern = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\[[^\]\n]+\]\([^\s)]+\)|\n)/g;
        let cursor = 0;
        let match;
        while ((match = tokenPattern.exec(source))) {
          if (match.index > cursor) fragment.appendChild(document.createTextNode(source.slice(cursor, match.index)));
          const token = match[0];
          if (token === '\n') {
            fragment.appendChild(document.createElement('br'));
          } else if (token.startsWith('**')) {
            const strong = document.createElement('strong');
            strong.textContent = token.slice(2, -2);
            fragment.appendChild(strong);
          } else if (token.startsWith('*')) {
            const em = document.createElement('em');
            em.textContent = token.slice(1, -1);
            fragment.appendChild(em);
          } else if (token.startsWith('`')) {
            const code = document.createElement('code');
            code.textContent = token.slice(1, -1);
            fragment.appendChild(code);
          } else {
            const parts = token.match(/^\[([^\]]+)\]\(([^\s)]+)\)$/);
            const href = parts && allowedHref(parts[2]);
            if (!parts || !href) {
              fragment.appendChild(document.createTextNode(token));
            } else {
              const link = document.createElement('a');
              link.textContent = parts[1];
              link.setAttribute('href', href);
              if (!href.startsWith('#')) {
                link.setAttribute('target', '_blank');
                link.setAttribute('rel', 'noopener noreferrer');
              }
              fragment.appendChild(link);
            }
          }
          cursor = tokenPattern.lastIndex;
        }
        if (cursor < source.length) fragment.appendChild(document.createTextNode(source.slice(cursor)));
        node.replaceChildren(fragment);
      }

      function insertPlainText(event, text) {
        event.preventDefault();
        const normalized = String(text || '').replace(/\r\n?/g, '\n');
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) return;
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const richText = event.currentTarget?.dataset.preserveMarkup === 'true';
        const fragment = document.createDocumentFragment();
        normalized.split('\n').forEach((line, index) => {
          if (index) fragment.appendChild(richText ? document.createElement('br') : document.createTextNode('\n'));
          if (line) fragment.appendChild(document.createTextNode(line));
        });
        if (!fragment.childNodes.length) fragment.appendChild(document.createTextNode(''));
        const lastNode = fragment.lastChild;
        range.insertNode(fragment);
        range.setStartAfter(lastNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }

      function bindEditor(node) {
        if (node.__editorBound) return;
        node.__editorBound = true;
        node.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') insertPlainText(event, '\n');
        });
        node.addEventListener('beforeinput', (event) => {
          if (event.inputType === 'insertParagraph' || event.inputType === 'insertLineBreak') insertPlainText(event, '\n');
        });
        node.addEventListener('paste', (event) => insertPlainText(event, event.clipboardData && event.clipboardData.getData('text/plain')));
        node.addEventListener('drop', (event) => insertPlainText(event, event.dataTransfer && event.dataTransfer.getData('text/plain')));
      }

      function bindImageSlot(slot) {
        const editing = document.body.classList.contains('is-editing');
        if (editing) {
          slot.setAttribute('role', 'button');
          slot.setAttribute('tabindex', '0');
        } else {
          slot.removeAttribute('role');
          slot.removeAttribute('tabindex');
        }
        if (slot.__imageSlotBound) return;
        slot.__imageSlotBound = true;
        let button = slot.querySelector('.image-insert-button');
        if (!button) {
          button = document.createElement('button');
          button.type = 'button';
          button.className = 'image-insert-button';
          button.textContent = '이미지 삽입';
          button.setAttribute('aria-label', '이미지 삽입');
          slot.appendChild(button);
        }
        const openImagePicker = () => {
          if (!document.body.classList.contains('is-editing')) return;
          pendingImageSlot = slot;
          imageUploadInput.value = '';
          try {
            if (typeof imageUploadInput.showPicker === 'function') imageUploadInput.showPicker();
            else imageUploadInput.click();
          } catch (error) {
            imageUploadInput.click();
          }
        };
        slot.addEventListener('click', openImagePicker);
        button.addEventListener('click', (event) => {
          event.stopPropagation();
          openImagePicker();
        });
        slot.addEventListener('keydown', (event) => {
          if (!document.body.classList.contains('is-editing') || event.target !== slot) return;
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          openImagePicker();
        });
      }

      function bindImageSlots() {
        document.querySelectorAll('.game-image, .case-thumb').forEach(bindImageSlot);
      }

      function openFilePicker(slot) {
        if (!document.body.classList.contains('is-editing')) return;
        pendingFileSlot = slot;
        fileUploadInput.value = '';
        try {
          if (typeof fileUploadInput.showPicker === 'function') fileUploadInput.showPicker();
          else fileUploadInput.click();
        } catch (error) {
          fileUploadInput.click();
        }
      }

      function bindFileSlot(slot) {
        if (slot.__fileSlotBound) return;
        slot.__fileSlotBound = true;
        let button = slot.parentElement.querySelector('.file-attach-button');
        if (!button) {
          button = document.createElement('button');
          button.type = 'button';
          button.className = 'file-attach-button';
          button.textContent = '파일 첨부';
          button.setAttribute('aria-label', '파일 첨부 또는 교체');
          slot.insertAdjacentElement('afterend', button);
        }
        slot.addEventListener('click', (event) => {
          if (document.body.classList.contains('is-editing')) {
            event.preventDefault();
            openFilePicker(slot);
            return;
          }
          if (slot.matches('a.is-file-link')) {
            event.preventDefault();
            showDocument(slot.getAttribute('href'), slot.textContent);
          }
        });
        button.addEventListener('click', () => openFilePicker(slot));
      }

      function bindFileSlots() {
        document.querySelectorAll('.case-file-value').forEach(bindFileSlot);
      }

      function bindReorderCard(card) {
        if (card.__reorderBound) return;
        card.__reorderBound = true;
        card.classList.add('reorderable');
        let handle = card.querySelector('.card-reorder-handle');
        if (!handle) {
          handle = document.createElement('button');
          handle.type = 'button';
          handle.className = 'card-reorder-handle';
          handle.textContent = '↕';
          handle.setAttribute('aria-label', '카드 순서 변경');
          handle.setAttribute('title', '누른 채 움직여 순서 변경');
          card.appendChild(handle);
        }
        let activeCard = null;
        const finishReorder = () => {
          if (!activeCard) return;
          activeCard.classList.remove('is-reordering');
          activeCard = null;
          editStatus.textContent = '카드 순서를 변경했다.';
        };
        handle.addEventListener('pointerdown', (event) => {
          if (!document.body.classList.contains('is-editing')) return;
          event.preventDefault();
          activeCard = card;
          activeCard.classList.add('is-reordering');
          handle.setPointerCapture(event.pointerId);
        });
        handle.addEventListener('pointermove', (event) => {
          if (!activeCard) return;
          const hovered = document.elementFromPoint(event.clientX, event.clientY);
          const target = hovered && hovered.closest(reorderableSelector);
          if (!target || target === activeCard || target.parentElement !== activeCard.parentElement) return;
          const rect = target.getBoundingClientRect();
          const insertBefore = event.clientY < rect.top + rect.height / 2 ||
            (Math.abs(event.clientY - (rect.top + rect.height / 2)) < rect.height / 4 && event.clientX < rect.left + rect.width / 2);
          activeCard.parentElement.insertBefore(activeCard, insertBefore ? target : target.nextSibling);
        });
        handle.addEventListener('pointerup', finishReorder);
        handle.addEventListener('pointercancel', finishReorder);
      }

      function bindReorderCards() {
        document.querySelectorAll(reorderableSelector).forEach(bindReorderCard);
      }

      function bindPortfolioLinks(editing) {
        document.querySelectorAll('.case-link').forEach((link) => {
          link.setAttribute('data-editable', 'true');
          if (!link.__linkBound) {
            link.__linkBound = true;
            link.addEventListener('click', (event) => {
              if (document.body.classList.contains('is-editing')) event.preventDefault();
            });
          }
          let input = link.parentElement.querySelector('.link-url-input');
          if (editing && !input) {
            input = document.createElement('input');
            input.type = 'url';
            input.className = 'link-url-input';
            input.placeholder = 'https:// 링크 주소 입력';
            input.setAttribute('aria-label', '포트폴리오 링크 주소');
            input.value = link.getAttribute('href') === '#' ? '' : link.getAttribute('href');
            input.addEventListener('input', () => {
              const href = allowedHref(input.value.trim());
              link.setAttribute('href', href || '#');
            });
            link.insertAdjacentElement('afterend', input);
          }
          if (!editing && input) input.remove();
        });
      }

      imageUploadInput.addEventListener('change', () => {
        const file = imageUploadInput.files && imageUploadInput.files[0];
        const slot = pendingImageSlot;
        pendingImageSlot = null;
        if (!file || !slot) return;
        const reader = new FileReader();
        reader.addEventListener('load', () => {
          slot.classList.add('image-uploaded');
          slot.style.backgroundImage = `url("${reader.result}")`;
          slot.style.backgroundSize = 'cover';
          slot.style.backgroundPosition = 'center';
          editStatus.textContent = '이미지를 삽입했다.';
        });
        reader.readAsDataURL(file);
      });

      fileUploadInput.addEventListener('change', () => {
        const file = fileUploadInput.files && fileUploadInput.files[0];
        const slot = pendingFileSlot;
        pendingFileSlot = null;
        if (!file || !slot) return;
        const reader = new FileReader();
        reader.addEventListener('load', () => {
          const link = document.createElement('a');
          link.className = 'case-file-value is-file-link';
          link.href = reader.result;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.download = file.name;
          link.textContent = file.name;
          link.setAttribute('aria-label', file.name + ' 열기');
          slot.replaceWith(link);
          const oldAttachButton = link.parentElement.querySelector('.file-attach-button');
          if (oldAttachButton) oldAttachButton.remove();
          bindFileSlot(link);
          editStatus.textContent = '파일을 첨부했다.';
        });
        reader.readAsDataURL(file);
      });

      function setEditMode(enabled) {
        document.body.classList.toggle('is-editing', enabled);
        editToggle.setAttribute('aria-pressed', String(enabled));
        editToggle.textContent = enabled ? '편집 완료' : '페이지 편집';
        bindPortfolioLinks(enabled);
        getEditableNodes().forEach((node) => {
          bindEditor(node);
          // The new cover uses styled inline elements as part of its layout.
          // Edit these in place so toggling the editor does not flatten them.
          const preserveMarkup = node.dataset.preserveMarkup === 'true' ||
            (node.closest('.landing-cover') && node.childElementCount > 0);
          if (preserveMarkup) {
            node.dataset.preserveMarkup = 'true';
            node.removeAttribute('data-markdown');
            node.setAttribute('contenteditable', String(enabled));
            node.querySelectorAll('[aria-hidden="true"]').forEach((decoration) => decoration.setAttribute('contenteditable', 'false'));
            return;
          }
          if (enabled) {
            if (node.getAttribute('contenteditable') === 'true') return;
            if (!node.hasAttribute('data-markdown')) node.setAttribute('data-markdown', readEditorSource(node));
            node.replaceChildren(document.createTextNode(node.getAttribute('data-markdown')));
          } else {
            if (node.getAttribute('contenteditable') === 'true') {
              const source = readEditorSource(node);
              node.setAttribute('data-markdown', source);
              renderMarkdown(node, source);
            }
            node.setAttribute('contenteditable', 'false');
            return;
          }
          node.setAttribute('contenteditable', 'true');
        });
        bindImageSlots();
        bindFileSlots();
        bindReorderCards();
        announce('portfolio:edit-change', { editing: enabled });
      }

      let sourceFileHandle = null;

      async function saveEditedPage() {
        if (editToggle.getAttribute('aria-pressed') === 'true') setEditMode(false);
        const gameListForSave = document.querySelector('#game-list');
        if (gameListForSave) gameListForSave.dataset.gameLibrarySaved = 'true';
        const savedDocument = document.documentElement.cloneNode(true);
        savedDocument.querySelector('body').classList.remove('is-editing');
        savedDocument.querySelector('body').classList.add('is-cover-page');
        savedDocument.querySelectorAll('.view').forEach((panel) => panel.classList.remove('is-active'));
        savedDocument.querySelectorAll('.view-tab[data-view]').forEach((tab, index) => {
          tab.classList.remove('is-active');
          tab.setAttribute('aria-selected', 'false');
          tab.setAttribute('tabindex', index === 0 ? '0' : '-1');
        });
        savedDocument.querySelectorAll('[aria-current]').forEach((node) => node.removeAttribute('aria-current'));
        savedDocument.querySelectorAll('.game-image, .case-thumb').forEach((slot) => {
          slot.removeAttribute('role');
          slot.removeAttribute('tabindex');
        });
        savedDocument.querySelectorAll('.link-url-input, [data-runtime-only]').forEach((node) => node.remove());
        savedDocument.querySelectorAll('.is-reordering').forEach((card) => card.classList.remove('is-reordering'));
        savedDocument.querySelectorAll('.image-unavailable').forEach((image) => image.classList.remove('image-unavailable'));
        savedDocument.querySelectorAll('#game-list .game-card').forEach((card) => {
          card.removeAttribute('hidden');
          card.style.removeProperty('display');
        });
        savedDocument.querySelectorAll('input[type="search"]').forEach((input) => input.removeAttribute('value'));
        savedDocument.querySelectorAll('dialog[open]').forEach((dialog) => dialog.removeAttribute('open'));
        const savedFrame = savedDocument.querySelector('#document-viewer-frame');
        if (savedFrame) savedFrame.removeAttribute('src');
        announce('portfolio:before-save', { document: savedDocument });
        const html = '<!doctype html>\n' + savedDocument.outerHTML;
        if (!('showOpenFilePicker' in window)) {
          window.alert('현재 파일 직접 적용을 지원하지 않는 브라우저입니다. Chrome 또는 Edge에서 열어 주세요.');
          return;
        }
        try {
          if (!sourceFileHandle) {
            const handles = await window.showOpenFilePicker({
              multiple: false,
              types: [{ description: 'HTML 파일', accept: { 'text/html': ['.html'] } }]
            });
            sourceFileHandle = handles[0];
          }
          const selectedFile = await sourceFileHandle.getFile();
          if (selectedFile.name.toLowerCase() !== 'index.html') {
            sourceFileHandle = null;
            window.alert('현재 사용 중인 index.html 파일을 선택해 주세요.');
            return;
          }
          const writable = await sourceFileHandle.createWritable();
          await writable.write(html);
          await writable.close();
          applyChanges.textContent = '적용 완료';
          editStatus.textContent = '현재 index.html 파일에 변경 사항을 적용했습니다.';
          window.setTimeout(() => { applyChanges.textContent = '현재 파일에 적용'; }, 1200);
        } catch (error) {
          if (error && error.name === 'AbortError') return;
          sourceFileHandle = null;
          window.alert('파일 적용 중 문제가 발생했습니다. 현재 index.html 파일을 다시 선택해 주세요.');
        }
      }

      function addFromTemplate(templateId, targetId, label, focusSelector) {
        const template = document.getElementById(templateId);
        const target = document.getElementById(targetId);
        const fragment = template.content.cloneNode(true);
        const added = fragment.firstElementChild;
        target.appendChild(fragment);
        setEditMode(editToggle.getAttribute('aria-pressed') === 'true');
        editStatus.textContent = label + '이 추가됐다.';
        const focusTarget = added.querySelector(focusSelector);
        if (focusTarget) focusTarget.focus();
      }

      function syncNavigation(viewId, updateHash) {
        document.querySelectorAll('video').forEach((video) => video.pause());
        landingPageLinks.forEach((link) => {
          if (link.dataset.pageTarget === viewId) link.setAttribute('aria-current', 'page');
          else link.removeAttribute('aria-current');
        });
        coverHomeLinks.forEach((link) => {
          if (viewId === 'home') link.setAttribute('aria-current', 'page');
          else link.removeAttribute('aria-current');
          if (link.classList.contains('view-tab')) link.classList.toggle('is-active', viewId === 'home');
        });
        if (updateHash && routeNames.has(viewId) && window.location.hash !== '#' + viewId) {
          window.history.pushState(null, '', '#' + viewId);
        }
        announce('portfolio:view-change', { viewId, view: viewId });
      }

      function activate(viewId, { updateHash = true, focus = true } = {}) {
        if (viewId === 'home') {
          showCover(true, updateHash);
          return;
        }
        const activePanel = panels.find((panel) => panel.id === viewId);
        if (!activePanel) return;
        document.body.classList.remove('is-cover-page');
        tabs.forEach((tab) => {
          const selected = tab.dataset.view === viewId;
          tab.classList.toggle('is-active', selected);
          tab.setAttribute('aria-selected', String(selected));
          tab.setAttribute('tabindex', selected ? '0' : '-1');
        });
        if (viewId === 'document-viewer' && tabs[0]) tabs[0].setAttribute('tabindex', '0');
        panels.forEach((panel) => panel.classList.toggle('is-active', panel.id === viewId));
        if (focus) activePanel.focus({ preventScroll: true });
        syncNavigation(viewId, updateHash);
      }

      function showDocument(source, name) {
        if (!source) return;
        activate('document-viewer', { updateHash: false });
        if (documentViewerFrame) documentViewerFrame.src = source;
        if (documentViewerName) documentViewerName.textContent = name || '첨부 문서';
        if (documentViewerDirect) documentViewerDirect.href = source;
        if (pageMenu) pageMenu.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      function showCover(shouldScroll = true, updateHash = true) {
        document.body.classList.add('is-cover-page');
        tabs.forEach((tab, index) => {
          tab.classList.remove('is-active');
          tab.setAttribute('aria-selected', 'false');
          tab.setAttribute('tabindex', index === 0 ? '0' : '-1');
        });
        panels.forEach((panel) => panel.classList.remove('is-active'));
        syncNavigation('home', updateHash);
        if (shouldScroll) window.scrollTo({ top: 0, behavior: 'smooth' });
      }

      function restoreRoute() {
        const route = window.location.hash.slice(1);
        if (routeNames.has(route) && route !== 'home') activate(route, { updateHash: false, focus: false });
        else if (!route || route === 'home') showCover(false, false);
        else {
          const anchor = document.getElementById(route);
          if (anchor?.closest('.landing-cover')) {
            showCover(false, false);
            window.requestAnimationFrame(() => anchor.scrollIntoView({ block: 'start' }));
          }
        }
      }

      window.addEventListener('hashchange', restoreRoute);
      restoreRoute();

      tabs.forEach((tab, index) => {
        tab.addEventListener('click', (event) => {
          event.preventDefault();
          activate(tab.dataset.view);
        });
        tab.addEventListener('keydown', (event) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          let next = index;
          if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
          if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
          if (event.key === 'Home') next = 0;
          if (event.key === 'End') next = tabs.length - 1;
          tabs[next].focus();
          activate(tabs[next].dataset.view, { focus: false });
        });
      });

      landingPageLinks.forEach((link) => {
        link.addEventListener('click', (event) => {
          event.preventDefault();
          activate(link.dataset.pageTarget);
          if (pageMenu) pageMenu.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });

      coverHomeLinks.forEach((link) => {
        link.addEventListener('click', (event) => {
          event.preventDefault();
          showCover();
        });
      });

      editToggle.addEventListener('click', () => {
        setEditMode(editToggle.getAttribute('aria-pressed') !== 'true');
      });
      applyChanges.addEventListener('click', saveEditedPage);
      addTool.addEventListener('click', () => addFromTemplate('tool-template', 'tool-grid', '프로그램', '.tool-name'));
      addGame.addEventListener('click', () => addFromTemplate('game-template', 'game-list', '게임', '.game-image span'));
      addPortfolio.addEventListener('click', () => addFromTemplate('portfolio-template', 'portfolio-grid', '포트폴리오 카드', '.case-copy h2'));

      const steamGameExperience = [
        ['1049590', '이터널 리턴', '3,954.0'], ['2584990', 'Shadowverse: Worlds Beyond', '835.2'], ['578080', 'PUBG: BATTLEGROUNDS', '760.7'], ['359550', '톰 클랜시의 레인보우식스 시즈', '555.6'], ['1623730', 'Palworld / 팰월드', '291.6'], ['899770', 'Last Epoch', '211.1'], ['3308670', '소녀전선2: 망명', '136.6'], ['1449850', 'Yu-Gi-Oh! Master Duel', '128.9'], ['892970', 'Valheim', '74.7'], ['1140150', '동방광요야 ~ Lost Branch of Legend', '68'], ['1621690', 'Core Keeper', '62.2'], ['322330', "Don't Starve Together", '59.6'], ['2468550', '비비드 월드', '49.3'], ['2739990', '작혼: 리치 마작', '47.4'], ['2868840', 'Slay the Spire 2', '46.3'], ['3241660', 'R.E.P.O.', '39.7'], ['1372810', '팀파이트 매니저', '39.3'], ['4347080', '보이드 다이버 : Escape from the Abyss Demo', '35.4'], ['527230', 'For The King', '35.2'], ['1963370', 'No One Survived', '35'], ['275850', "No Man's Sky", '32.5'], ['2379780', 'Balatro', '32'], ['5075020', '꼬미 (Little LUMI Model)', '29'], ['3164500', 'Schedule I', '27'], ['1966720', 'Lethal Company', '23.4'], ['568220', 'Lobotomy Corporation', '19'], ['2698780', 'ContractVille', '18.5'], ['3419430', 'Bongo Cat', '16'], ['924970', 'Back 4 Blood', '15.9'], ['2784470', '9 Kings 나인 킹즈', '15.6'], ['582010', 'Monster Hunter: World', '15.2'], ['413150', 'Stardew Valley', '15.1'], ['3167020', 'Escape from Duckov', '14.8'], ['1169040', 'Necesse: 네세스', '14.7'], ['1782120', 'ZERO Sievert', '13.6'], ['108600', 'Project Zomboid', '11.8'], ['648800', 'Raft', '11.5'], ['1188930', '크로노 아크', '10.3'], ['671860', 'BattleBit Remastered', '10.1'], ['3527290', 'PEAK', '9.3'], ['646570', 'Slay the Spire', '9.2'], ['2828860', 'The Forever Winter', '8.2'], ['2185060', '투 포인트 뮤지엄', '8'], ['1948280', 'Stacklands', '7.4'], ['3059520', 'F1® 25', '7.3'], ['1203620', '인슈라오디드 (Enshrouded)', '7.3'], ['1584090', "동방야작식당 - Touhou Mystia's Izakaya", '7.1'], ['2436940', '세피리아', '6.6'], ['1649080', 'Two Point Campus', '6.5'], ['281990', 'Stellaris', '6.4'], ['3101040', 'Magical Girl Witch Trials', '6.3'], ['3400000', 'Cubic Odyssey', '6.1'], ['1062520', 'Dinkum (딩컴)', '6.1'], ['4508340', '이환', '6.1'], ['1363080', 'Manor Lords 매너 로드', '5.9'], ['2420510', 'HoloCure - Save the Fans!', '5.8'], ['2273420', '관리인의 엿보기', '5.5'], ['2878420', '옛날 재래시장 시뮬레이터', '5.3'], ['2881650', 'Content Warning', '5.2'], ['535930', 'Two Point Hospital', '5.2'], ['1868140', '데이브 더 다이버', '5.2'], ['2683150', 'Ale & Tale Tavern', '5.2'], ['2737070', 'Crime Simulator', '5.1'], ['3070070', 'TCG Card Shop Simulator', '4.8'], ['477160', 'Human Fall Flat', '4.5'], ['1972440', 'Shotgun King: The Final Checkmate', '4.4'], ['1172620', 'Sea of Thieves', '4'], ['1600360', 'The Cycle Playtest', '4'], ['1978100', '그랑프리 스토리 (Grand Prix Story)', '3.3'], ['1962700', '서브노티카 2', '3'], ['105600', 'Terraria', '117.1'], ['428180', '아일렛 온라인 : 크래프트', '89.4'], ['289070', "Sid Meier's Civilization VI", '56.9'], ['453480', 'Shadowverse', '51.3'], ['503940', 'Railway Empire', '33.5'], ['2078890', 'Dark and Darker Playtest', '30.6'], ['774171', 'Muse Dash', '16.4'], ['858810', 'Dawn of Man', '15.2'], ['1217390', '썸썸 편의점', '14.9'], ['1104330', "Founders' Fortune", '14'], ['242920', 'Banished', '12.5'], ['1129580', 'Medieval Dynasty', '10.9'], ['305620', 'The Long Dark', '8.7'], ['582550', 'Passpartout: The Starving Artist', '6.9'], ['1210030', 'Novena Diabolos', '6.8'], ['8500', '이브 온라인', '5.5'], ['995460', '기적의 분식집', '4.5'], ['346110', 'ARK: Survival Evolved', '3.8'], ['346010', 'Besiege', '3.8'], ['265930', 'Goat Simulator', '3.6'], ['698780', 'Doki Doki Literature Club', '3.1']
      ];

      const steamGameImageSources = {
        '3059520': 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3059520/111acdc401454a19bc728b030bcc4b49769677e0/capsule_616x353.jpg?t=1786646076',
        '3527290': 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3527290/b233cb6e95308a74fb8dac2cfc1c1cfcf14a20d5/capsule_616x353_alt_assets_3.jpg?t=1786470571',
        '4347080': 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/4347080/a062589632f97b25348066e9fe107942a42c5a8e/capsule_616x353.jpg?t=1788227242',
        '4508340': 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/4508340/4b52466e311f27994e7e79f88094ebc4da694a68/capsule_616x353.jpg?t=1788321687',
        '5075020': 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/5075020/8ea8f28c4a201da176b20ab9b35621ec115b8118/capsule_616x353.jpg?t=1788866498'
      };

      function makeSteamGameCard([appId, name, hours]) {
        const card = document.createElement('article');
        card.className = 'game-card reorderable';

        const imageSlot = document.createElement('div');
        imageSlot.className = 'game-image';
        imageSlot.dataset.imageSlotBound = 'true';
        imageSlot.setAttribute('aria-label', `${name} 대표 이미지`);
        const image = document.createElement('img');
        image.src = steamGameImageSources[appId] || `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`;
        image.alt = '';
        image.loading = 'lazy';
        const imageName = document.createElement('span');
        imageName.textContent = name;
        imageSlot.append(image, imageName);

        const body = document.createElement('div');
        body.className = 'game-body';
        const title = document.createElement('h3');
        title.textContent = name;
        const details = document.createElement('p');
        details.className = 'game-details';
        const record = document.createElement('span');
        const label = document.createElement('b');
        label.textContent = '플레이 시간';
        record.append(label, ` ${hours}시간`);
        details.append(record);
        body.append(title, details);
        card.append(imageSlot, body);
        return card;
      }

      const customGameEntries = [
        { name: '이환', period: '2026.04~진행중', imageUrl: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/4508340/4b52466e311f27994e7e79f88094ebc4da694a68/capsule_616x353.jpg?t=1788321687', genres: ['오픈 월드', '액션 RPG', '수집형 RPG'] },
        { name: 'Star Citizen', period: '2021.05~2026.01', imageUrl: 'https://dto9r5vaiz7bu.cloudfront.net/49piebp1x6b6n/source.jpg', genres: ['우주 시뮬레이션', 'MMO', 'FPS'] },
        { name: '리버스: 1999', period: '2023.10~2024.09', imageUrl: 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/3092660/header.jpg', genres: ['턴제 전략 RPG', '수집형 RPG'] },
        { name: '월드 오브 워쉽', period: '2023.02~2025.12', imageUrl: 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/552990/header.jpg', genres: ['해전', 'MMO', '밀리터리'] },
        { name: '블루 아카이브', period: '2021.11~2023.10', imageUrl: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3557620/b723141fa8cf93bb2bb56d03789561341a2cad62/header.jpg?t=1779773548', genres: ['전술 RPG', '수집형 RPG'] },
        { name: '원신', period: '2020.09~2022.11', imageUrl: 'https://webstatic.hoyoverse.com/upload/uploadstatic/contentweb/20210428/2021042807203374622.jpg', genres: ['오픈 월드', '액션 RPG', '수집형 RPG'] },
        { name: '월드 플리퍼', period: '2021.09~2024.01', imageUrl: 'https://worldflipper.jp/assets/images/ogp.jpg', genres: ['핀볼 액션 RPG', '수집형 RPG'] },
        { name: '백야극광', period: '2021.06~2022.09', imageUrl: 'https://static.inven.co.kr/column/2021/06/23/news/i16577401799.jpg', genres: ['퍼즐 전략 RPG', '수집형 RPG'] },
        { name: '무기미도', period: '2022.10~2023.05', imageUrl: 'https://res09.bignox.com/appcenter/th/2022/10/appcenter.jpg', genres: ['실시간 전략 RPG', '디펜스', '수집형 RPG'] },
        { name: '명일방주', period: '2020.10~2022.07', imageUrl: 'https://digitalchosun.dizzo.com/site/data/img_dir/2019/10/01/2019100180192_0.jpg', genres: ['타워 디펜스', '전략 RPG', '수집형 RPG'] },
        { name: '명일방주: 엔드필드', period: '2026.01~2026.08', imageUrl: 'https://images.igdb.com/igdb/image/upload/t_original/ar5jeu.jpg', genres: ['실시간 전략 RPG', '기지 건설', '액션 RPG'] }
      ];

      function makeCustomGameCard({ name, period, imageUrl }) {
        const card = document.createElement('article');
        card.className = 'game-card reorderable custom-game-card';

        const imageSlot = document.createElement('div');
        imageSlot.className = 'game-image';
        imageSlot.setAttribute('aria-label', `${name} 대표 이미지`);
        const image = document.createElement('img');
        image.src = imageUrl;
        image.alt = '';
        image.loading = 'lazy';
        const imageName = document.createElement('span');
        imageName.textContent = name;
        imageSlot.append(image, imageName);

        const body = document.createElement('div');
        body.className = 'game-body';
        const title = document.createElement('h3');
        title.textContent = name;
        const details = document.createElement('p');
        details.className = 'game-details';
        const record = document.createElement('span');
        const label = document.createElement('b');
        label.textContent = '플레이 기간';
        record.append(label, ` ${period}`);
        details.append(record);
        body.append(title, details);
        card.append(imageSlot, body);
        return card;
      }

      function updateCustomGameCard(card, { name, period, imageUrl }) {
        const imageSlot = card.querySelector('.game-image');
        let image = imageSlot.querySelector('img');
        if (!image) {
          image = document.createElement('img');
          image.alt = '';
          image.loading = 'lazy';
          imageSlot.prepend(image);
        }
        image.src = imageUrl;
        imageSlot.querySelector('span').textContent = name;
        card.querySelector('.game-body h3').textContent = name;
        const record = card.querySelector('.game-details > span');
        record.replaceChildren();
        const label = document.createElement('b');
        label.textContent = '플레이 기간';
        record.append(label, ` ${period}`);
      }

      const terraria = steamGameExperience.find(([appId]) => appId === '105600');
      if (terraria) terraria[2] = '123.4';
      const rainbowSixSiege = steamGameExperience.find(([appId]) => appId === '359550');
      if (rainbowSixSiege) rainbowSixSiege[2] = '1,035.6';
      const excludedSteamAppIds = new Set(['2273420']);
      const visibleSteamGameExperience = steamGameExperience.filter(([appId]) => !excludedSteamAppIds.has(appId));
      visibleSteamGameExperience.sort((a, b) => Number(b[2].replace(/,/g, '')) - Number(a[2].replace(/,/g, '')));

      const gameList = document.querySelector('#game-list');
      const hasSavedGameLibrary = gameList?.dataset.gameLibrarySaved === 'true' || gameList?.children.length > 3;
      if (gameList && !hasSavedGameLibrary) {
        const gameCards = document.createDocumentFragment();
        visibleSteamGameExperience.forEach((game) => gameCards.append(makeSteamGameCard(game)));
        gameList.replaceChildren(gameCards);
      }
      const preserveSavedGameEdits = gameList?.dataset.gameLibrarySaved === 'true';
      if (gameList && !preserveSavedGameEdits) customGameEntries.forEach((game) => {
        const savedCard = Array.from(gameList.querySelectorAll('.game-card')).find((card) => card.querySelector('.game-body h3')?.textContent.trim() === game.name);
        if (savedCard) updateCustomGameCard(savedCard, game);
        else gameList.append(makeCustomGameCard(game));
      });
      if (gameList && !preserveSavedGameEdits) {
        const rainbowSixCard = Array.from(gameList.querySelectorAll('.game-card')).find((card) => card.querySelector('.game-body h3')?.textContent.trim() === '톰 클랜시의 레인보우식스 시즈');
        const record = rainbowSixCard?.querySelector('.game-details > span');
        if (record) {
          record.replaceChildren();
          const label = document.createElement('b');
          label.textContent = '플레이 시간';
          record.append(label, ' 1,035.6시간');
        }
      }
      bindImageSlots();
      bindFileSlots();
      bindReorderCards();

      document.querySelectorAll('.project-hero-video video').forEach((video) => {
        const videoFrame = video.closest('.project-hero-video');
        if (!videoFrame) return;

        video.muted = true;
        video.defaultMuted = true;
        video.volume = 0;

        videoFrame.addEventListener('pointerenter', () => {
          const playback = video.play();
          if (playback && typeof playback.catch === 'function') playback.catch(() => {});
        });

        videoFrame.addEventListener('pointerleave', () => {
          video.pause();
          video.currentTime = 0;
        });
      });
      setEditMode(false);
    }());
