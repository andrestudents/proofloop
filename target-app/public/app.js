// Signup form logic — intentionally unvalidated (that's the agent's job to add).
const form = document.getElementById("signup-form");
const message = document.getElementById("message");

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  message.className = "message success";
  message.textContent = `Account created for ${name || "new user"} (${email || "no email"})!`;
  form.reset();
});
