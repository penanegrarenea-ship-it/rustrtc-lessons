/* 测验：点选即时反馈。每个 .quiz 里的 button[data-ok="1"] 是正确答案。 */
(function () {
  document.querySelectorAll(".quiz").forEach(function (quiz) {
    var fb = quiz.querySelector(".fb");
    quiz.querySelectorAll("button").forEach(function (b) {
      b.addEventListener("click", function () {
        quiz.querySelectorAll("button").forEach(function (x) {
          x.classList.remove("right", "wrong");
        });
        if (b.dataset.ok === "1") {
          b.classList.add("right");
          if (fb) fb.textContent = quiz.dataset.okText || "对。";
        } else {
          b.classList.add("wrong");
          if (fb) fb.textContent = quiz.dataset.badText || "不对，再看一眼选项。";
        }
      });
    });
  });
})();
