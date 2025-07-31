document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  
  // Admin elements
  const adminSection = document.getElementById("admin-section");
  const userIcon = document.getElementById("user-icon");
  const adminStatus = document.getElementById("admin-status");
  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const closeModal = document.querySelector(".close");
  const adminNotice = document.getElementById("admin-notice");
  const studentNotice = document.getElementById("student-notice");

  // Check if user is already logged in
  let isAdminLoggedIn = localStorage.getItem('adminToken') !== null;
  let adminToken = localStorage.getItem('adminToken');

  // Function to update UI based on admin status
  function updateUIForAdminStatus() {
    if (isAdminLoggedIn) {
      adminStatus.style.display = 'flex';
      adminNotice.style.display = 'block';
      studentNotice.style.display = 'none';
      
      // Enable delete buttons for admin
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.disabled = false;
      });
    } else {
      adminStatus.style.display = 'none';
      adminNotice.style.display = 'none';
      studentNotice.style.display = 'block';
      
      // Disable delete buttons for students
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.disabled = true;
      });
    }
  }

  // Modal functionality
  userIcon.addEventListener("click", () => {
    if (isAdminLoggedIn) {
      logout();
    } else {
      loginModal.style.display = "block";
    }
  });

  closeModal.addEventListener("click", () => {
    loginModal.style.display = "none";
  });

  window.addEventListener("click", (event) => {
    if (event.target === loginModal) {
      loginModal.style.display = "none";
    }
  });

  // Handle admin login
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    
    try {
      const response = await fetch("/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        adminToken = result.token;
        localStorage.setItem('adminToken', adminToken);
        isAdminLoggedIn = true;
        loginModal.style.display = "none";
        loginForm.reset();
        
        showMessage("Successfully logged in as teacher", "success");
        updateUIForAdminStatus();
      } else {
        showMessage(result.detail || "Login failed", "error");
      }
    } catch (error) {
      showMessage("Login failed. Please try again.", "error");
      console.error("Login error:", error);
    }
  });

  // Handle logout
  function logout() {
    localStorage.removeItem('adminToken');
    adminToken = null;
    isAdminLoggedIn = false;
    updateUIForAdminStatus();
    showMessage("Logged out successfully", "info");
  }

  // Add logout button event listener
  document.getElementById("logout-btn").addEventListener("click", logout);

  // Function to show messages
  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");
    
    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span><button class="delete-btn" data-activity="${name}" data-email="${email}" ${!isAdminLoggedIn ? 'disabled' : ''}>❌</button></li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });

      // Update UI state after activities are loaded
      updateUIForAdminStatus();
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    
    // Check if admin is logged in
    if (!isAdminLoggedIn) {
      showMessage("Only teachers can unregister participants", "error");
      return;
    }
    
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${adminToken}`
          }
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        
        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        if (response.status === 401) {
          // Token expired or invalid
          logout();
          showMessage("Session expired. Please log in again.", "error");
        } else {
          showMessage(result.detail || "An error occurred", "error");
        }
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const headers = {};
      if (isAdminLoggedIn) {
        headers["Authorization"] = `Bearer ${adminToken}`;
      }

      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: headers
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        if (response.status === 401 && isAdminLoggedIn) {
          // Token expired or invalid
          logout();
          showMessage("Session expired. Please log in again.", "error");
        } else {
          showMessage(result.detail || "An error occurred", "error");
        }
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  // Initialize app
  fetchActivities();
});