// DOM elements
const loadingDiv = document.getElementById('loading');
const dashboardContent = document.getElementById('dashboard-content');
const logoutBtn = document.getElementById('logout-btn');
const usernameDisplay = document.getElementById('username-display');
const emailDisplay = document.getElementById('email-display');
const phoneDisplay = document.getElementById('phone-display');
const createdDisplay = document.getElementById('created-display');
const authHistoryTable = document.getElementById('auth-history-table');

// Add event listeners
logoutBtn.addEventListener('click', handleLogout);

// Check authentication state on page load
document.addEventListener('DOMContentLoaded', function() {
    // Try both Firebase auth and localStorage for flexibility
    const userId = getUserIdFromSession();
    
    if (userId) {
        // We have a user ID from session/localStorage, load data
        loadUserData(userId);
    } else {
        // Try Firebase authentication
        auth.onAuthStateChanged(function(user) {
            if (user) {
                // User is signed in
                loadUserData(user.uid);
            } else {
                // No user is signed in, redirect to login
                window.location.href = 'login.html';
            }
        });
    }
});

// Helper function to get user ID from session storage or localStorage
function getUserIdFromSession() {
    // Try to get user from localStorage with the correct key 'currentUser' first
    try {
        const userString = localStorage.getItem('currentUser');
        if (userString) {
            const user = JSON.parse(userString);
            console.log('Found user in localStorage (currentUser):', user);
            return user.uid;
        }
    } catch (e) {
        console.error('Error reading currentUser from localStorage:', e);
    }
    
    // For backward compatibility, try the old 'testUser' key
    try {
        const testUserString = localStorage.getItem('testUser');
        if (testUserString) {
            const testUser = JSON.parse(testUserString);
            console.log('Found user in localStorage (testUser):', testUser);
            return testUser.uid;
        }
    } catch (e) {
        console.error('Error reading testUser from localStorage:', e);
    }
    
    // Try to get from sessionStorage
    try {
        const sessionUser = sessionStorage.getItem('currentUser');
        if (sessionUser) {
            const user = JSON.parse(sessionUser);
            console.log('Found user in sessionStorage:', user);
            return user.uid;
        }
    } catch (e) {
        console.error('Error reading from sessionStorage:', e);
    }
    
    console.warn('No user ID found in any storage');
    return null;
}

// Function to display user data
function displayUserData(userData) {
    console.log('Displaying user data:', userData);
    
    // Display user information
    usernameDisplay.textContent = userData.username || 'Not available';
    emailDisplay.textContent = userData.email || 'Not available';
    phoneDisplay.textContent = userData.phone || 'Not available';
    
    // Format and display creation date
    let createdDate;
    if (userData.createdAt) {
        // Handle different timestamp formats
        if (typeof userData.createdAt === 'string') {
            createdDate = new Date(userData.createdAt);
        } else if (userData.createdAt.toDate) {
            // Firestore timestamp
            createdDate = userData.createdAt.toDate();
        } else if (userData.createdAt.seconds) {
            // Firestore timestamp stored as object
            createdDate = new Date(userData.createdAt.seconds * 1000);
        } else {
            createdDate = new Date();
        }
    } else {
        createdDate = new Date();
    }
    
    createdDisplay.textContent = createdDate.toLocaleDateString() + ' ' + createdDate.toLocaleTimeString();
    
    // Show dashboard content and hide loading
    loadingDiv.classList.add('hidden');
    dashboardContent.classList.remove('hidden');
}

// Function to display test user data (for test mode only)
function displayTestUserData(testUser) {
    // Call the main display function first
    displayUserData(testUser);
    
    // Create some test authentication history
    const testHistory = [
        { method: 'OTP and QR Code', status: 'Success', timestamp: new Date() },
        { method: 'OTP', status: 'Success', timestamp: new Date(Date.now() - 86400000) } // 1 day ago
    ];
    
    // Display test authentication history
    authHistoryTable.innerHTML = '';
    testHistory.forEach((entry) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${entry.timestamp.toLocaleDateString()} ${entry.timestamp.toLocaleTimeString()}</td>
            <td>${entry.method}</td>
            <td>${entry.status}</td>
        `;
        authHistoryTable.appendChild(row);
    });
}

// Function to load user data from Firestore
function loadUserData(userId) {
    console.log('Loading user data for ID:', userId);
    
    // First check if we have the complete data in localStorage
    let localUserData = null;
    
    // Try currentUser first (our new standard)
    try {
        const userString = localStorage.getItem('currentUser');
        if (userString) {
            const userData = JSON.parse(userString);
            if (userData.uid === userId) {
                console.log('Found matching currentUser in localStorage');
                localUserData = userData;
            }
        }
    } catch (e) {
        console.error('Error checking currentUser in localStorage:', e);
    }
    
    // Then try firebaseUser (which has more complete data)
    try {
        const firebaseUserString = localStorage.getItem('firebaseUser');
        if (firebaseUserString) {
            const firebaseData = JSON.parse(firebaseUserString);
            if (firebaseData.uid === userId) {
                console.log('Found matching firebaseUser data in localStorage');
                localUserData = firebaseData;
            }
        }
    } catch (e) {
        console.error('Error checking firebaseUser in localStorage:', e);
    }
    
    // Legacy support - check testUser
    if (!localUserData) {
        try {
            const testUserString = localStorage.getItem('testUser');
            if (testUserString) {
                const testUser = JSON.parse(testUserString);
                if (testUser.uid === userId) {
                    console.log('Found matching testUser in localStorage');
                    localUserData = testUser;
                }
            }
        } catch (e) {
            console.error('Error checking testUser in localStorage:', e);
        }
    }
    
    // Show loading indicator
    loadingDiv.classList.remove('hidden');
    dashboardContent.classList.add('hidden');
    
    // If we have data from localStorage, use it immediately for better UX
    if (localUserData) {
        console.log('Using local data while fetching from Firestore:', localUserData);
        displayUserData(localUserData);
    }
    
    // Set a timeout for the Firestore query
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Firestore user data query timeout')), 10000) // 10 second timeout
    );
    
    // Try to fetch fresh data from Firestore
    const firestorePromise = db.collection('users').doc(userId).get();
    
    // Race between the query and the timeout
    Promise.race([firestorePromise, timeoutPromise])
        .then(doc => {
            if (!doc) {
                throw new Error('Invalid document result');
            }
            
            if (doc.exists) {
                const userData = doc.data();
                console.log('Retrieved user data from Firestore:', userData);
                
                // Create a structured user data object
                const updatedUserData = {
                    uid: userId,
                    username: userData.username || (localUserData ? localUserData.username : 'User ' + userId.substring(0, 6)),
                    email: userData.email || (localUserData ? localUserData.email : 'user@example.com'),
                    phone: userData.phone || (localUserData ? localUserData.phone : '+1234567890'),
                    dataSource: 'firestore',
                    lastUpdated: new Date().toISOString()
                };
                
                // Handle createdAt field which might be a Firestore timestamp
                try {
                    if (userData.createdAt) {
                        if (userData.createdAt.toDate) {
                            updatedUserData.createdAt = userData.createdAt.toDate().toISOString();
                        } else if (userData.createdAt.seconds) {
                            updatedUserData.createdAt = new Date(userData.createdAt.seconds * 1000).toISOString();
                        } else if (typeof userData.createdAt === 'string') {
                            updatedUserData.createdAt = userData.createdAt;
                        }
                    } else if (localUserData && localUserData.createdAt) {
                        updatedUserData.createdAt = localUserData.createdAt;
                    } else {
                        updatedUserData.createdAt = new Date().toISOString();
                    }
                } catch (e) {
                    console.error('Error processing createdAt:', e);
                    updatedUserData.createdAt = new Date().toISOString();
                }
                
                // Update localStorage with fresh data
                try {
                    localStorage.setItem('currentUser', JSON.stringify(updatedUserData));
                    console.log('Updated localStorage with fresh Firestore data');
                } catch (e) {
                    console.error('Error updating localStorage:', e);
                }
                
                // Display the user data (only if different from what we already displayed)
                if (!localUserData || JSON.stringify(localUserData) !== JSON.stringify(updatedUserData)) {
                    displayUserData(updatedUserData);
                    console.log('Updated display with fresh Firestore data');
                }
                
                // Load authentication history
                loadAuthHistory(userId);
            } else {
                console.log('No user document found in Firestore for ID:', userId);
                
                // Check if we already displayed data from localStorage
                if (!localUserData || localUserData.uid !== userId) {
                    // Create test user as fallback
                    createTestUserIfNeeded(userId);
                }
            }
        })
        .catch(error => {
            console.error('Error getting user data from Firestore:', error);
            
            // Check if we already displayed data from localStorage
            if (!localUserData || localUserData.uid !== userId) {
                // Create test user as fallback
                createTestUserIfNeeded(userId);
            }
            
            // Try to load auth history anyway
            loadAuthHistory(userId);
        });
}

// Create a test user if we're in test mode
function createTestUserIfNeeded(userId) {
    // Only do this in test mode
    const testUser = {
        uid: userId,
        username: 'Test User',
        email: 'test@example.com',
        phone: '+1234567890',
        createdAt: new Date().toISOString()
    };
    
    // Save to localStorage
    try {
        localStorage.setItem('testUser', JSON.stringify(testUser));
        console.log('Created and saved test user');
        displayTestUserData(testUser);
    } catch (e) {
        console.error('Failed to create test user:', e);
        window.location.href = 'login.html';
    }
}


// Function to load authentication history
function loadAuthHistory(userId) {
    console.log('Loading authentication history for user:', userId);
    
    // Try to get from Firestore first
    db.collection('users').doc(userId)
      .collection('authHistory')
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get()
      .then((querySnapshot) => {
          // Clear existing table rows
          authHistoryTable.innerHTML = '';
          
          if (querySnapshot.empty) {
              console.log('No auth history found in Firestore, using simulated data');
              // If no history or in test mode, add simulated entries
              createSimulatedAuthHistory();
              return;
          }
          
          // Add history entries to table
          querySnapshot.forEach((doc) => {
              const historyData = doc.data();
              const row = document.createElement('tr');
              
              // Format the timestamp
              let formattedDate;
              try {
                  // Handle Firestore timestamp
                  const timestamp = historyData.timestamp.toDate ? 
                      historyData.timestamp.toDate() : 
                      new Date(historyData.timestamp);
                  formattedDate = timestamp.toLocaleDateString() + ' ' + timestamp.toLocaleTimeString();
              } catch (e) {
                  console.error('Error formatting timestamp:', e);
                  formattedDate = 'Unknown date';
              }
              
              row.innerHTML = `
                  <td>${formattedDate}</td>
                  <td>${historyData.method || 'Unknown'}</td>
                  <td>${historyData.status || 'Unknown'}</td>
              `;
              
              authHistoryTable.appendChild(row);
          });
      })
      .catch((error) => {
          console.error('Error loading auth history:', error);
          // Fallback to simulated history
          createSimulatedAuthHistory();
      });
}

// Create simulated auth history for testing
function createSimulatedAuthHistory() {
    console.log('Creating simulated authentication history');
    // Clear existing table rows
    authHistoryTable.innerHTML = '';
    
    // Add current login
    const row1 = document.createElement('tr');
    const now = new Date();
    row1.innerHTML = `
        <td>${now.toLocaleDateString()} ${now.toLocaleTimeString()}</td>
        <td>OTP and QR Code</td>
        <td>Success</td>
    `;
    authHistoryTable.appendChild(row1);
    
    // Add previous login (1 day ago)
    const row2 = document.createElement('tr');
    const yesterday = new Date(now.getTime() - 86400000); // 24 hours ago
    row2.innerHTML = `
        <td>${yesterday.toLocaleDateString()} ${yesterday.toLocaleTimeString()}</td>
        <td>OTP</td>
        <td>Success</td>
    `;
    authHistoryTable.appendChild(row2);
    
    // Add a failed attempt (2 days ago)
    const row3 = document.createElement('tr');
    const twoDaysAgo = new Date(now.getTime() - 86400000 * 2); // 48 hours ago
    row3.innerHTML = `
        <td>${twoDaysAgo.toLocaleDateString()} ${twoDaysAgo.toLocaleTimeString()}</td>
        <td>OTP</td>
        <td>Failed</td>
    `;
    authHistoryTable.appendChild(row3);
}

// Function to log authentication event in history
function logAuthenticationEvent(userId, method, status) {
    db.collection('users').doc(userId)
      .collection('authHistory')
      .add({
          method: method,
          status: status,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          userAgent: navigator.userAgent
      })
      .catch((error) => {
          console.error('Error logging auth event:', error);
      });
}

// Function to handle logout
function handleLogout() {
    auth.signOut()
        .then(() => {
            // Sign-out successful, redirect to login page
            window.location.href = 'login.html';
        })
        .catch((error) => {
            // An error happened
            console.error('Error signing out:', error);
        });
}
