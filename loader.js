document.addEventListener("DOMContentLoaded", () => {
  const loader = document.getElementById("global-loader");
  const loaderPercentage = document.getElementById("loader-percentage");
  const body = document.body;

  let progress = 0;
  const increment = 1;
  const intervalTime = 15;

  const interval = setInterval(() => {
    progress += increment;
    if (progress > 100) progress = 100;

    if (loaderPercentage) {
      loaderPercentage.textContent = progress + "%";
    }

    if (progress >= 100) {
      clearInterval(interval);
      setTimeout(() => {
        if (loader) loader.style.display = "none";
        body.classList.remove("overflow-hidden");
      }, 300);
    }
  }, intervalTime);
});