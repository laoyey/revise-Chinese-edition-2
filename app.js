(() => {
  "use strict";

  const chapters = window.QUIZ_DATA;
  const STORAGE_KEY = "interest-rate-studio-v1";
  const letters = ["A", "B", "C", "D"];
  const typeColors = { "概念辨析": "#6d5dfc", "计算应用": "#e5aa45", "情境分析": "#38a78b" };

  chapters.forEach(chapter => {
    chapter.questions.forEach((q, index) => {
      q.id = `${chapter.id}-q${String(index + 1).padStart(2, "0")}`;
      q.number = index + 1;
    });
  });

  const $ = id => document.getElementById(id);
  const els = {
    sidebar: $("sidebar"), backdrop: $("sidebarBackdrop"), homeNav: $("homeNav"), chapterNav: $("chapterNav"),
    breadcrumb: $("breadcrumb"), homeView: $("homeView"), quizView: $("quizView"),
    overallStats: $("overallStats"), chapterCards: $("chapterCards"), continueButton: $("continueButton"),
    quizEyebrow: $("quizEyebrow"), quizTitle: $("quizTitle"), quizDescription: $("quizDescription"),
    progressStats: $("chapterProgressStats"), progressFill: $("chapterProgressFill"),
    questionPosition: $("questionPosition"), questionMeta: $("questionMeta"), questionText: $("questionText"),
    optionsList: $("optionsList"), feedback: $("feedback"), bookmarkButton: $("bookmarkButton"),
    sourceLabel: $("sourceLabel"), questionCard: $("questionCard"), emptyState: $("emptyState"),
    prevButton: $("prevButton"), nextButton: $("nextButton"), questionMap: $("questionMap"),
    mapCount: $("mapCount"), typeBreakdown: $("typeBreakdown"), scoreDialog: $("scoreDialog"),
    scoreContent: $("scoreContent"), toast: $("toast")
  };

  function freshState() {
    const orders = {}, currentIds = {}, filters = {};
    chapters.forEach(chapter => {
      orders[chapter.id] = chapter.questions.map(q => q.id);
      currentIds[chapter.id] = chapter.questions[0].id;
      filters[chapter.id] = "all";
    });
    return {
      view: "home", currentChapter: "ch02", lastChapter: "ch02",
      answers: {}, bookmarks: [], orders, currentIds, filters
    };
  }

  function loadState() {
    const base = freshState();
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved || typeof saved !== "object") return base;
      const merged = { ...base, ...saved };
      merged.answers = saved.answers && typeof saved.answers === "object" ? saved.answers : {};
      merged.bookmarks = Array.isArray(saved.bookmarks) ? saved.bookmarks : [];
      merged.orders = { ...base.orders, ...(saved.orders || {}) };
      merged.currentIds = { ...base.currentIds, ...(saved.currentIds || {}) };
      merged.filters = { ...base.filters, ...(saved.filters || {}) };
      if (!chapters.some(c => c.id === merged.currentChapter)) merged.currentChapter = "ch02";
      chapters.forEach(chapter => {
        const validIds = new Set(chapter.questions.map(q => q.id));
        const savedOrder = Array.isArray(merged.orders[chapter.id]) ? merged.orders[chapter.id] : [];
        const cleanOrder = savedOrder.filter((id, i) => validIds.has(id) && savedOrder.indexOf(id) === i);
        chapter.questions.forEach(q => { if (!cleanOrder.includes(q.id)) cleanOrder.push(q.id); });
        merged.orders[chapter.id] = cleanOrder;
        if (!validIds.has(merged.currentIds[chapter.id])) merged.currentIds[chapter.id] = cleanOrder[0];
      });
      return merged;
    } catch (_) { return base; }
  }

  let state = loadState();
  let toastTimer;
  const currentChapter = () => chapters.find(c => c.id === state.currentChapter);
  const allQuestions = () => chapters.flatMap(c => c.questions);
  const getQuestion = id => allQuestions().find(q => q.id === id);
  const isBookmarked = id => state.bookmarks.includes(id);
  const save = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) { /* file privacy mode */ }
  };
  const escapeHTML = value => String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const chapterStats = chapter => {
    const answered = chapter.questions.filter(q => state.answers[q.id] !== undefined).length;
    const correct = chapter.questions.filter(q => state.answers[q.id] === q.answer).length;
    const marked = chapter.questions.filter(q => isBookmarked(q.id)).length;
    return { answered, correct, wrong: answered - correct, marked, total: chapter.questions.length };
  };
  const globalStats = () => {
    const answered = allQuestions().filter(q => state.answers[q.id] !== undefined).length;
    const correct = allQuestions().filter(q => state.answers[q.id] === q.answer).length;
    return { answered, correct, wrong: answered - correct, marked: state.bookmarks.length, total: allQuestions().length };
  };
  const typeCounts = chapter => chapter.questions.reduce((acc, q) => { acc[q.type] = (acc[q.type] || 0) + 1; return acc; }, {});
  const softColor = hex => `${hex}16`;

  function showToast(message) {
    clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.classList.add("show");
    toastTimer = setTimeout(() => els.toast.classList.remove("show"), 1800);
  }

  function closeSidebar() {
    els.sidebar.classList.remove("open");
    els.backdrop.classList.remove("open");
  }

  function goHome() {
    state.view = "home";
    save();
    render();
    closeSidebar();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openChapter(chapterId) {
    state.currentChapter = chapterId;
    state.lastChapter = chapterId;
    state.view = "quiz";
    save();
    render();
    closeSidebar();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function filteredQuestions(chapter) {
    const filter = state.filters[chapter.id];
    return state.orders[chapter.id].map(getQuestion).filter(q => {
      const answer = state.answers[q.id];
      if (filter === "unanswered") return answer === undefined;
      if (filter === "wrong") return answer !== undefined && answer !== q.answer;
      if (filter === "bookmarked") return isBookmarked(q.id);
      return true;
    });
  }

  function renderChapterNav() {
    els.chapterNav.innerHTML = chapters.map(chapter => {
      const stats = chapterStats(chapter);
      return `<button class="nav-item ${state.view === "quiz" && state.currentChapter === chapter.id ? "active" : ""}" data-chapter="${chapter.id}" type="button">
        <span class="nav-icon">${chapter.id === "ch02" ? "∑" : chapter.id === "ch03" ? "↗" : "⌁"}</span>
        <span class="nav-copy"><strong>${chapter.chapter}</strong><small>${chapter.title}</small></span>
        <span class="nav-progress">${stats.answered}/${stats.total}</span>
      </button>`;
    }).join("");
    els.chapterNav.querySelectorAll("[data-chapter]").forEach(button => button.addEventListener("click", () => openChapter(button.dataset.chapter)));
    els.homeNav.classList.toggle("active", state.view === "home");
  }

  function renderHome() {
    const stats = globalStats();
    const accuracy = stats.answered ? Math.round(stats.correct / stats.answered * 100) : 0;
    els.overallStats.innerHTML = [
      ["题库总量", stats.total, "道单项选择题", "▤"],
      ["已经完成", stats.answered, `还剩 ${stats.total - stats.answered} 题`, "✓"],
      ["当前正确率", `${accuracy}%`, stats.answered ? `答对 ${stats.correct} 题` : "等待你的首答", "◎"],
      ["收藏题目", stats.marked, "用于考前回顾", "☆"]
    ].map(([label, value, note, icon]) => `<div class="stat-card"><div class="stat-label"><span>${label}</span><span class="stat-icon">${icon}</span></div><strong>${value}</strong><small>${note}</small></div>`).join("");

    els.chapterCards.innerHTML = chapters.map(chapter => {
      const stats = chapterStats(chapter);
      const counts = typeCounts(chapter);
      const distribution = Object.entries(counts).map(([type, count]) => `<span style="width:${count / stats.total * 100}%;background:${typeColors[type]}" title="${type} ${count} 题"></span>`).join("");
      const legend = Object.entries(counts).map(([type, count]) => `<span>${type} ${count}</span>`).join("");
      return `<article class="chapter-card" style="--chapter-color:${chapter.color};--chapter-soft:${softColor(chapter.color)}">
        <div class="chapter-number"><span>${chapter.chapter.toUpperCase()}</span><small>50 QUESTIONS</small></div>
        <div><h3>${chapter.title}</h3><p class="chapter-english">${chapter.englishTitle}</p></div>
        <p class="chapter-description">${chapter.description}</p>
        <div><div class="distribution">${distribution}</div><div class="distribution-legend">${legend}</div></div>
        <div class="chapter-card-footer"><span>已完成 ${stats.answered}/50 · 答对 ${stats.correct}</span><button class="card-start" data-start="${chapter.id}" type="button">${stats.answered ? "继续练习" : "开始练习"} →</button></div>
      </article>`;
    }).join("");
    els.chapterCards.querySelectorAll("[data-start]").forEach(button => button.addEventListener("click", () => openChapter(button.dataset.start)));
    els.continueButton.textContent = stats.answered ? `继续 ${chapters.find(c => c.id === state.lastChapter).chapter}` : "从第一章开始";
  }

  function renderProgress(chapter) {
    const stats = chapterStats(chapter);
    const accuracy = stats.answered ? Math.round(stats.correct / stats.answered * 100) : 0;
    els.progressStats.innerHTML = `<div><strong>${stats.answered}</strong><span>/ ${stats.total} 已答</span></div><div><strong>${stats.correct}</strong><span>答对</span></div><div><strong>${stats.wrong}</strong><span>答错</span></div><div class="accuracy"><strong>${accuracy}%</strong><span>已答正确率</span></div>`;
    els.progressFill.style.width = `${stats.answered / stats.total * 100}%`;
  }

  function renderQuestion(chapter) {
    const filtered = filteredQuestions(chapter);
    const hasQuestions = filtered.length > 0;
    els.questionCard.classList.toggle("hidden", !hasQuestions);
    els.emptyState.classList.toggle("hidden", hasQuestions);
    document.querySelector(".question-navigation").classList.toggle("hidden", !hasQuestions);
    els.questionPosition.textContent = hasQuestions ? `${filtered.length} 题可练习` : "0 题";
    if (!hasQuestions) {
      els.prevButton.disabled = els.nextButton.disabled = true;
      renderMap(chapter);
      return;
    }

    let index = filtered.findIndex(q => q.id === state.currentIds[chapter.id]);
    if (index < 0) {
      index = 0;
      state.currentIds[chapter.id] = filtered[0].id;
      save();
    }
    const q = filtered[index];
    const selected = state.answers[q.id];
    const answered = selected !== undefined;
    const isCorrect = selected === q.answer;
    const marked = isBookmarked(q.id);

    els.questionPosition.textContent = `当前 ${index + 1} / ${filtered.length}`;
    els.questionMeta.innerHTML = `<span class="meta-badge type">${q.type}</span><span class="meta-badge topic">${escapeHTML(q.topic)}</span><span class="meta-badge number">QUESTION ${String(q.number).padStart(2, "0")}</span>`;
    els.questionText.textContent = q.q;
    els.optionsList.innerHTML = q.options.map((option, optionIndex) => {
      let className = "option-button";
      let status = "";
      if (answered) {
        if (optionIndex === q.answer) { className += " correct"; status = "✓"; }
        else if (optionIndex === selected) { className += " wrong"; status = "×"; }
        else className += " dimmed";
      }
      return `<button class="${className}" data-option="${optionIndex}" type="button" ${answered ? "disabled" : ""}><span class="option-letter">${letters[optionIndex]}</span><span class="option-text">${escapeHTML(option)}</span><span class="option-status">${status}</span></button>`;
    }).join("");
    els.optionsList.querySelectorAll("[data-option]").forEach(button => button.addEventListener("click", () => answerQuestion(q, Number(button.dataset.option))));

    els.feedback.classList.toggle("hidden", !answered);
    if (answered) {
      els.feedback.classList.toggle("is-wrong", !isCorrect);
      els.feedback.innerHTML = `<div class="feedback-title">${isCorrect ? "✓ 回答正确" : "× 回答错误"}</div><p>${!isCorrect ? `<span class="correct-answer">正确答案：${letters[q.answer]}．${escapeHTML(q.options[q.answer])}</span><br>` : ""}${escapeHTML(q.explanation)}</p>`;
    }
    els.bookmarkButton.classList.toggle("active", marked);
    els.bookmarkButton.innerHTML = `<span>${marked ? "★" : "☆"}</span> ${marked ? "已收藏" : "收藏本题"}`;
    els.bookmarkButton.onclick = () => toggleBookmark(q.id);
    els.sourceLabel.textContent = `课件 PDF 第 ${q.page} 页 · ${q.topic}`;
    els.prevButton.disabled = index === 0;
    els.nextButton.disabled = index === filtered.length - 1;
    els.prevButton.onclick = () => navigateQuestion(-1);
    els.nextButton.onclick = () => navigateQuestion(1);
    renderMap(chapter);
  }

  function renderMap(chapter) {
    const stats = chapterStats(chapter);
    els.mapCount.textContent = `${stats.answered} / ${stats.total}`;
    els.questionMap.innerHTML = state.orders[chapter.id].map(getQuestion).map(q => {
      const answer = state.answers[q.id];
      const status = answer === undefined ? "" : answer === q.answer ? "correct" : "wrong";
      const classes = ["map-button", status, q.id === state.currentIds[chapter.id] ? "current" : "", isBookmarked(q.id) ? "bookmarked" : ""].filter(Boolean).join(" ");
      return `<button class="${classes}" data-map-id="${q.id}" type="button" title="第 ${q.number} 题 · ${escapeHTML(q.topic)}">${q.number}</button>`;
    }).join("");
    els.questionMap.querySelectorAll("[data-map-id]").forEach(button => button.addEventListener("click", () => {
      state.currentIds[chapter.id] = button.dataset.mapId;
      save(); renderQuestion(chapter);
      if (window.innerWidth < 821) els.questionCard.scrollIntoView({ behavior: "smooth", block: "start" });
    }));
    const counts = typeCounts(chapter);
    els.typeBreakdown.innerHTML = Object.entries(counts).map(([type, count]) => `<div class="type-row"><span>${type}</span><strong>${count} 题 · ${Math.round(count / stats.total * 100)}%</strong></div>`).join("");
  }

  function renderQuiz() {
    const chapter = currentChapter();
    els.quizView.style.setProperty("--chapter-color", chapter.color);
    els.quizView.style.setProperty("--chapter-soft", softColor(chapter.color));
    els.quizEyebrow.textContent = `${chapter.chapter.toUpperCase()} · ${chapter.englishTitle.toUpperCase()}`;
    els.quizTitle.textContent = chapter.title;
    els.quizDescription.textContent = chapter.description;
    document.querySelectorAll(".filter-button").forEach(button => button.classList.toggle("active", button.dataset.filter === state.filters[chapter.id]));
    renderProgress(chapter);
    renderQuestion(chapter);
  }

  function render() {
    const home = state.view === "home";
    els.homeView.classList.toggle("hidden", !home);
    els.quizView.classList.toggle("hidden", home);
    const chapter = currentChapter();
    els.breadcrumb.innerHTML = `<span>金融学</span><b>/</b><strong>${home ? "学习总览" : `${chapter.chapter} · ${chapter.title}`}</strong>`;
    document.title = home ? "利率学习室 · 三章交互题库" : `${chapter.chapter} ${chapter.title} · 利率学习室`;
    renderChapterNav();
    if (home) renderHome(); else renderQuiz();
  }

  function answerQuestion(question, optionIndex) {
    if (state.answers[question.id] !== undefined) return;
    state.answers[question.id] = optionIndex;
    save();
    renderChapterNav();
    renderProgress(currentChapter());
    renderQuestion(currentChapter());
  }

  function navigateQuestion(direction) {
    const chapter = currentChapter();
    const filtered = filteredQuestions(chapter);
    const index = filtered.findIndex(q => q.id === state.currentIds[chapter.id]);
    const target = filtered[index + direction];
    if (!target) return;
    state.currentIds[chapter.id] = target.id;
    save(); renderQuestion(chapter);
    els.questionCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function toggleBookmark(id) {
    if (isBookmarked(id)) {
      state.bookmarks = state.bookmarks.filter(item => item !== id);
      showToast("已取消收藏");
    } else {
      state.bookmarks.push(id);
      showToast("已加入收藏，方便考前回顾");
    }
    save(); renderQuestion(currentChapter());
  }

  function setFilter(filter) {
    const chapter = currentChapter();
    state.filters[chapter.id] = filter;
    const filtered = filteredQuestions(chapter);
    if (filtered.length && !filtered.some(q => q.id === state.currentIds[chapter.id])) state.currentIds[chapter.id] = filtered[0].id;
    save();
    document.querySelectorAll(".filter-button").forEach(button => button.classList.toggle("active", button.dataset.filter === filter));
    renderQuestion(chapter);
  }

  function shuffleChapter() {
    const chapter = currentChapter();
    const order = [...state.orders[chapter.id]];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    state.orders[chapter.id] = order;
    save(); renderQuestion(chapter);
    showToast("本章题序已随机排列，答题记录已保留");
  }

  function showScore() {
    const chapter = currentChapter();
    const stats = chapterStats(chapter);
    const percent = Math.round(stats.correct / stats.total * 100);
    const counts = typeCounts(chapter);
    const rows = Object.keys(counts).map(type => {
      const questions = chapter.questions.filter(q => q.type === type);
      const correct = questions.filter(q => state.answers[q.id] === q.answer).length;
      const answered = questions.filter(q => state.answers[q.id] !== undefined).length;
      return `<div class="score-type-row"><span>${type}</span><div class="score-type-track"><div class="score-type-fill" style="width:${correct / questions.length * 100}%"></div></div><strong>${correct}/${questions.length} · 已答${answered}</strong></div>`;
    }).join("");
    els.scoreContent.innerHTML = `<div class="score-header"><span>CHAPTER REPORT</span><h2>${chapter.chapter} · 本章成绩</h2><div class="score-ring" style="--score-angle:${percent * 3.6}deg;--chapter-color:${chapter.color}"><div><strong>${stats.correct * 2}</strong><small>满分 100</small></div></div></div>
      <div class="score-summary"><div><strong>${stats.correct}</strong><span>答对</span></div><div><strong>${stats.wrong}</strong><span>答错</span></div><div><strong>${stats.total - stats.answered}</strong><span>未答</span></div></div>
      <div class="score-types">${rows}</div>
      <div class="score-actions"><button class="secondary-button" id="scoreCloseInner" type="button">继续练习</button><button class="primary-button" id="reviewWrongButton" type="button" ${stats.wrong ? "" : "disabled"}>复习错题 ${stats.wrong ? `(${stats.wrong})` : ""}</button></div>`;
    els.scoreDialog.showModal();
    $("scoreCloseInner").onclick = () => els.scoreDialog.close();
    $("reviewWrongButton").onclick = () => { els.scoreDialog.close(); setFilter("wrong"); };
  }

  function resetChapter() {
    const chapter = currentChapter();
    if (!window.confirm(`确定清空 ${chapter.chapter} 的全部作答记录吗？收藏会保留。`)) return;
    chapter.questions.forEach(q => delete state.answers[q.id]);
    state.currentIds[chapter.id] = state.orders[chapter.id][0];
    state.filters[chapter.id] = "all";
    save(); render(); showToast("本章作答记录已清空");
  }

  function resetAll() {
    if (!window.confirm("确定清空三章的全部作答、收藏与题序记录吗？此操作无法撤销。")) return;
    state = freshState();
    save(); render(); showToast("全部学习记录已清空");
  }

  els.homeNav.addEventListener("click", goHome);
  $("startButton").addEventListener("click", () => openChapter("ch02"));
  els.continueButton.addEventListener("click", () => openChapter(state.lastChapter));
  $("menuButton").addEventListener("click", () => { els.sidebar.classList.add("open"); els.backdrop.classList.add("open"); });
  els.backdrop.addEventListener("click", closeSidebar);
  $("shuffleButton").addEventListener("click", shuffleChapter);
  $("scoreButton").addEventListener("click", showScore);
  $("resetChapterButton").addEventListener("click", resetChapter);
  $("resetAllButton").addEventListener("click", resetAll);
  $("closeScoreButton").addEventListener("click", () => els.scoreDialog.close());
  $("showAllButton").addEventListener("click", () => setFilter("all"));
  document.querySelectorAll(".filter-button").forEach(button => button.addEventListener("click", () => setFilter(button.dataset.filter)));
  els.scoreDialog.addEventListener("click", event => {
    const rect = els.scoreDialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) els.scoreDialog.close();
  });

  document.addEventListener("keydown", event => {
    if (state.view !== "quiz" || els.scoreDialog.open || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    const chapter = currentChapter();
    const q = getQuestion(state.currentIds[chapter.id]);
    if (["1", "2", "3", "4"].includes(event.key) && q && state.answers[q.id] === undefined && filteredQuestions(chapter).some(item => item.id === q.id)) {
      answerQuestion(q, Number(event.key) - 1);
    } else if (event.key === "ArrowLeft") { event.preventDefault(); navigateQuestion(-1); }
    else if (event.key === "ArrowRight") { event.preventDefault(); navigateQuestion(1); }
    else if (event.key.toLowerCase() === "b" && q) toggleBookmark(q.id);
  });

  render();
})();
