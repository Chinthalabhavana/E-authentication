// DOM elements
const loginForm = document.getElementById('login-form');
const phoneAuthDiv = document.getElementById('phone-auth');
const qrSection = document.getElementById('qr-section');
const loginBtn = document.getElementById('login-btn');
const verifyBtn = document.getElementById('verify-btn');
const resendBtn = document.getElementById('resend-btn');
const verifyQrBtn = document.getElementById('verify-qr-btn');
const phoneInput = document.getElementById('phone');
const verificationCodeInput = document.getElementById('verification-code');
const errorMessage = document.getElementById('error-message');
const successMessage = document.getElementById('success-message');
const qrcodeContainer = document.getElementById('qrcode-container');

// Global variables
let verificationId = null;
let currentUser = null;
let qrCodeValue = null;
let currentPhoneNumber = null; // Store the current phone number for verification
let testMode = true; // Set to true for testing without server

// Add event listeners
loginBtn.addEventListener('click', startLogin);
verifyBtn.addEventListener('click', verifyOTP);
resendBtn.addEventListener('click', resendOTP);

// Function to start login process
function startLogin() {
    // Clear previous messages
    errorMessage.textContent = '';
    successMessage.textContent = '';

    // Validate phone number
    const phone = phoneInput.value.trim();
    currentPhoneNumber = phone; // Store the phone number

    if (!phone) {
        errorMessage.textContent = 'Please enter your mobile number';
        return;
    }

    // Validate phone number format
    if (!phone.startsWith('+')) {
        errorMessage.textContent = 'Phone number must include country code (e.g., +91xxxxxxxxxx)';
        return;
    }

    // Start authentication
    startPhoneAuth(phone);
}

// Function to initiate phone authentication
function startPhoneAuth(phoneNumber) {
    // Show loading message
    successMessage.textContent = 'Sending OTP...';
    errorMessage.textContent = ''; // Clear any previous error messages
    
    console.log('Checking if phone number exists:', phoneNumber);
    
    // Add a timeout to abort the Firestore query if it takes too long
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Firestore query timeout')), 15000) // 15 second timeout
    );
    
    // Create the Firestore query - Make sure we get a valid user by checking both phone field formats
    const queryPromise = Promise.all([
        db.collection('users').where('phone', '==', phoneNumber).get(),
        // Also try without the '+' prefix if it has one, or with one if it doesn't
        phoneNumber.startsWith('+') 
            ? db.collection('users').where('phone', '==', phoneNumber.substring(1)).get()
            : db.collection('users').where('phone', '==', '+' + phoneNumber).get()
    ]);
    
    // Race between the query and the timeout
    Promise.race([queryPromise, timeoutPromise])
        .then((queryResults) => {
            if (!queryResults || !Array.isArray(queryResults)) {
                throw new Error('Invalid query result');
            }
            
            // Combine results from both queries
            const combinedResults = [];
            queryResults.forEach(snapshot => {
                if (snapshot && !snapshot.empty) {
                    snapshot.docs.forEach(doc => combinedResults.push(doc));
                }
            });
            
            console.log('Phone number query found ' + combinedResults.length + ' matching users');
            
            if (combinedResults.length === 0) {
                console.warn('No account found with phone number:', phoneNumber);
                errorMessage.textContent = 'No account found with this phone number. Please register first.';
                successMessage.textContent = '';
                return;
            }
            
            console.log('Found user account with this phone number');
            // Store user info for later use - use the first match
            const userDoc = combinedResults[0];
            const userData = userDoc.data();
            const userId = userDoc.id;
            console.log('User data from query:', {id: userId, ...userData});
            
            // Enhanced user data with defensive coding to handle various data formats
            const pendingUserData = {
                uid: userId,
                username: userData.username || 'User ' + userId.substring(0, 6),
                email: userData.email || 'user@example.com',
                phone: phoneNumber,
                loginStarted: new Date().toISOString()
            };
            
            // Try to add additional fields if they exist
            if (userData.createdAt) {
                try {
                    if (userData.createdAt.toDate) {
                        pendingUserData.createdAt = userData.createdAt.toDate().toISOString();
                    } else if (userData.createdAt.seconds) {
                        pendingUserData.createdAt = new Date(userData.createdAt.seconds * 1000).toISOString();
                    } else if (typeof userData.createdAt === 'string') {
                        pendingUserData.createdAt = userData.createdAt;
                    }
                } catch (e) {
                    console.error('Error processing createdAt:', e);
                    pendingUserData.createdAt = new Date().toISOString();
                }
            }
            
            // Store the user data in localStorage immediately for backup
            try {
                localStorage.setItem('pendingLoginUser', JSON.stringify(pendingUserData));
                console.log('Stored pending user data in localStorage for backup');
            } catch (e) {
                console.error('Error saving to localStorage:', e);
            }
            
            // Check if we're running from file:// protocol
            if (window.location.protocol === 'file:') {
                // In file protocol, we can't make fetch requests to PHP files
                // So we'll simulate the OTP process for testing
                console.log('Running in file:// protocol - using simulated OTP mode');
                
                // Generate a random 6-digit OTP for testing
                const testOTP = Math.floor(100000 + Math.random() * 900000);
                console.log('=============================================')
                console.log('TEST MODE: Your OTP code is:', testOTP);
                console.log('=============================================')
                
                // Store the test OTP in a global variable for verification
                window.testOTP = testOTP;
                
                // Hide login form and show OTP verification form
                loginForm.classList.add('hidden');
                phoneAuthDiv.classList.remove('hidden');
                
                successMessage.textContent = 'TEST MODE: OTP sent successfully. Check console for OTP code (F12)';
                
                // Simulate successful response
                return;
            }
            
            // Normal server mode - use the PHP API
            fetch('twilio-api.php?endpoint=send-otp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    phoneNumber: phoneNumber
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Hide login form and show OTP verification form
                    loginForm.classList.add('hidden');
                    phoneAuthDiv.classList.remove('hidden');
                    
                    successMessage.textContent = 'OTP sent successfully to your email address';
                    console.log('OTP sent successfully to email');
                } else {
                    // Error sending OTP
                    errorMessage.textContent = 'Error sending OTP: ' + data.message;
                    successMessage.textContent = '';
                }
            })
            .catch(error => {
                console.error('Error sending OTP:', error);
                errorMessage.textContent = 'Error sending OTP: ' + error.message;
                successMessage.textContent = '';
            });
        })
        .catch((error) => {
            console.error('Error checking user:', error);
            errorMessage.textContent = 'Error checking user: ' + error.message;
            successMessage.textContent = '';
        });
}

// Function to verify OTP
function verifyOTP() {
    // Clear previous messages
    errorMessage.textContent = '';
    successMessage.textContent = '';

    const code = verificationCodeInput.value.trim();
    
    if (!code) {
        errorMessage.textContent = 'Please enter the OTP';
        return;
    }

    // Check if we're in test/file protocol mode
    if (window.location.protocol === 'file:' || window.testOTP) {
        console.log('TEST MODE: Verifying OTP...');
        
        // Check if entered OTP matches the test OTP
        if (code === window.testOTP.toString()) {
            // Verification successful
            console.log('TEST MODE: OTP verified successfully!');
            successMessage.textContent = 'OTP verified successfully!';
            
            // Create a test user
            currentUser = { uid: 'test-user-' + Date.now() };
            console.log('TEST MODE: Created test user ID:', currentUser.uid);
            
            // Generate QR code for second-factor authentication
            generateQrCode();
        } else {
            // OTP does not match
            console.error('TEST MODE: Invalid OTP entered.');
            errorMessage.textContent = 'Invalid OTP. Please enter the exact OTP shown in the console.';
        }
        return;
    }

    // Verify OTP with Email OTP API
    fetch('email-otp.php?endpoint=verify-otp', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            phoneNumber: currentPhoneNumber,
            otp: code
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // OTP verified successfully
            successMessage.textContent = 'OTP verified successfully!';
            console.log('OTP verified successfully for phone:', currentPhoneNumber);
            
            // Get user data from Firestore - try both phone field and direct document lookup
            const phoneQuery = db.collection('users').where('phone', '==', currentPhoneNumber).get();
            
            phoneQuery.then((querySnapshot) => {
                console.log('Phone query results:', querySnapshot.size);
                
                if (!querySnapshot.empty) {
                    // Found user by phone number
                    const userDoc = querySnapshot.docs[0];
                    const userData = userDoc.data();
                    console.log('Retrieved user data by phone:', userData);
                    
                    currentUser = {
                        uid: userDoc.id,
                        ...userData
                    };
                    
                    // Store in localStorage for easier access
                    try {
                        localStorage.setItem('currentUser', JSON.stringify(currentUser));
                        console.log('Saved user data to localStorage');
                    } catch (e) {
                        console.error('Error saving to localStorage:', e);
                    }
                    
                    // Generate QR code for second-factor authentication
                    generateQrCode();
                } else {
                    // No user found by phone, try searching all documents as a fallback
                    console.warn('No user found with phone number:', currentPhoneNumber);
                    
                    // Since this is a small app, we can try to get all users and filter
                    db.collection('users').get().then(snapshot => {
                        console.log('Checking all users as fallback, found:', snapshot.size);
                        
                        let foundUser = false;
                        
                        snapshot.forEach(doc => {
                            const data = doc.data();
                            console.log('Checking user:', data.username, 'phone:', data.phone);
                            
                            // Case-insensitive comparison or partial match
                            if (data.phone && data.phone.includes(currentPhoneNumber.substring(1)) || 
                                currentPhoneNumber.includes(data.phone.substring(1))) {
                                console.log('Found potential user match by partial phone:', data);
                                currentUser = {
                                    uid: doc.id,
                                    ...data
                                };
                                
                                foundUser = true;
                                
                                // Store in localStorage
                                try {
                                    localStorage.setItem('currentUser', JSON.stringify(currentUser));
                                } catch (e) {
                                    console.error('Error saving to localStorage:', e);
                                }
                                
                                // Generate QR code
                                generateQrCode();
                                return;
                            }
                        });
                        
                        if (!foundUser) {
                            console.error('Failed to find any matching user');
                            errorMessage.textContent = 'User data not found. Please try registering again.';
                        }
                    }).catch(error => {
                        console.error('Error in fallback user search:', error);
                        errorMessage.textContent = 'Error finding user data: ' + error.message;
                    });
                }
            })
                .catch(error => {
                    console.error('Error fetching user data:', error);
                    errorMessage.textContent = 'Error fetching user data: ' + error.message;
                });
        } else {
            // Invalid OTP
            errorMessage.textContent = data.message;
        }
    })
    .catch(error => {
        console.error('Error verifying OTP:', error);
        errorMessage.textContent = 'Error verifying OTP: ' + error.message;
    });
}

// Function to generate QR code for second-factor authentication
function generateQrCode() {
    // Hide OTP verification form and show QR section
    phoneAuthDiv.classList.add('hidden');
    qrSection.classList.remove('hidden');
    
    // Generate a session ID for this authentication attempt
    const sessionId = 'session_' + Date.now();
    const userId = currentUser.uid;
    
    // Create the verification URL that will be encoded in the QR code
    // This URL points to our auth-verify.html page with the session and user IDs
    const verificationUrl = window.location.origin + 
        window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/')) + 
        '/auth-verify.html?session=' + sessionId + '&user=' + userId;
    
    // For file:// protocol, create a simpler URL
    const qrCodeUrl = window.location.protocol === 'file:' ? 
        'auth-verify.html?session=' + sessionId + '&user=' + userId : verificationUrl;
    
    console.log('QR Code URL:', qrCodeUrl);
    
    // Set the QR code value
    qrCodeValue = qrCodeUrl;
    
    // Update scan status message
    document.getElementById('scan-status').textContent = 'Waiting for mobile verification...';
    
    // Start automatic verification process after QR code is displayed
    setTimeout(() => {
        startAutomaticVerification(sessionId, userId);
    }, 500);
    
    // Always try to generate QR code regardless of mode
    console.log('Generating QR code with value:', qrCodeValue);
    
    try {
        // Clear any previous QR codes
        qrcodeContainer.innerHTML = '';
        
        // Create QR code
        new QRCode(qrcodeContainer, {
            text: qrCodeValue,
            width: 200,
            height: 200,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    } catch (error) {
        console.error('Error generating QR code:', error);
        errorMessage.textContent = 'Error generating QR code: ' + error.message;
        
        // Fallback - display text version if QR code fails
        qrcodeContainer.innerHTML = '<div style="border:1px solid #000; padding:20px; text-align:center;">QR Code:<br>' + qrCodeValue + '</div>';
    }
    
    // Only return early if in test mode
    if (testMode) {
        return;
    }
    
    // Normal mode - store in Firestore
    db.collection('users').doc(currentUser.uid).update({
        qrCodeValue: qrCodeValue,
        qrCodeTimestamp: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
        // Create QR code
        new QRCode(qrcodeContainer, {
            text: qrCodeValue,
            width: 200,
            height: 200,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    })
    .catch((error) => {
        console.error('Error updating Firestore:', error);
        errorMessage.textContent = 'Error generating QR code: ' + error.message;
        
        // Try to generate QR code anyway
        try {
            new QRCode(qrcodeContainer, {
                text: qrCodeValue,
                width: 200,
                height: 200,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
        } catch (qrError) {
            console.error('Backup QR generation failed:', qrError);
        }
    });
}

// Function to start automatic verification of QR code
function startAutomaticVerification(sessionId, userId) {
    const scanStatusElement = document.getElementById('scan-status');
    
    // If we're in test mode, simulate the verification process
    if (window.testOTP) {
        console.log('Starting automatic verification for session:', sessionId);
        scanStatusElement.textContent = 'Waiting for mobile verification...';
        
        // In test mode, simulate the mobile verification automatically
        setTimeout(() => {
            // Create a simple mobile verification dialog that appears automatically
            const verifyDialog = document.createElement('div');
            verifyDialog.style.position = 'fixed';
            verifyDialog.style.top = '50%';
            verifyDialog.style.left = '50%';
            verifyDialog.style.transform = 'translate(-50%, -50%)';
            verifyDialog.style.backgroundColor = 'white';
            verifyDialog.style.padding = '20px';
            verifyDialog.style.borderRadius = '8px';
            verifyDialog.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
            verifyDialog.style.zIndex = '1000';
            
            verifyDialog.innerHTML = `
                <h3 style="margin-top:0">Mobile Authentication</h3>
                <p>Allow login for user ${userId.substring(0,6)}...?</p>
                <div style="display:flex; justify-content:space-between">
                    <button id="allow-btn" style="background:#4CAF50; color:white; border:none; padding:8px 16px; cursor:pointer">Allow</button>
                    <button id="deny-btn" style="background:#f44336; color:white; border:none; padding:8px 16px; cursor:pointer">Not Allow</button>
                </div>
            `;
            
            document.body.appendChild(verifyDialog);
            
            // Add event listeners to buttons
            document.getElementById('allow-btn').addEventListener('click', () => {
                document.body.removeChild(verifyDialog);
                handleSuccessfulVerification(userId);
            });
            
            document.getElementById('deny-btn').addEventListener('click', () => {
                document.body.removeChild(verifyDialog);
                handleFailedVerification('Authentication denied from mobile device.');
            });
        }, 1500); // Simulate a delay before verification dialog appears
        
        return;
    }
    
    // In production mode, we would poll Firestore for status updates
    const checkInterval = 2000; // Check every 2 seconds
    const maxAttempts = 30; // Maximum number of attempts (60 seconds total)
    let attempts = 0;
    
    // Check Firestore for verification status
    const checkVerificationStatus = () => {
        attempts++;
        console.log(`Checking verification status (attempt ${attempts}/${maxAttempts})`);
        
        // Update the status message with countdown
        scanStatusElement.textContent = `Waiting for mobile verification... (${maxAttempts - attempts} seconds remaining)`;
        
        // Check Firestore for the session status
        db.collection('authSessions').doc(sessionId).get()
            .then((doc) => {
                if (doc.exists) {
                    const sessionData = doc.data();
                    
                    if (sessionData.status === 'approved') {
                        // Verification approved
                        clearInterval(intervalId);
                        handleSuccessfulVerification(userId);
                    } else if (sessionData.status === 'denied') {
                        // Verification denied
                        clearInterval(intervalId);
                        handleFailedVerification('Authentication denied from mobile device.');
                    } else if (attempts >= maxAttempts) {
                        // Timeout
                        clearInterval(intervalId);
                        handleFailedVerification('Mobile verification timed out. Please try again.');
                    }
                    // If status is pending or not set, continue polling
                } else if (attempts >= maxAttempts) {
                    // Session not found and timeout reached
                    clearInterval(intervalId);
                    handleFailedVerification('Mobile verification timed out. Please try again.');
                }
                // If session not found but still within timeout, continue polling
            })
            .catch((error) => {
                console.error('Error checking verification status:', error);
                if (attempts >= maxAttempts) {
                    clearInterval(intervalId);
                    handleFailedVerification('Error checking verification status: ' + error.message);
                }
            });
    };
    
    // Start polling
    const intervalId = setInterval(checkVerificationStatus, checkInterval);
    
    // Check immediately
    checkVerificationStatus();
}

// Handle successful verification
function handleSuccessfulVerification(userId) {
    // Update UI
    successMessage.textContent = 'Authentication successful! Retrieving user data...';
    errorMessage.textContent = '';
    document.getElementById('scan-status').textContent = 'Verified successfully!';
    
    // First check if we have any pending login data to use as fallback
    let fallbackData = null;
    try {
        const pendingData = localStorage.getItem('pendingLoginUser');
        if (pendingData) {
            fallbackData = JSON.parse(pendingData);
            console.log('Found pending login data to use as fallback:', fallbackData);
        }
    } catch (e) {
        console.error('Error reading pending login data:', e);
    }
    
    // Get the complete user data from Firestore before redirecting
    db.collection('users').doc(userId).get()
        .then(doc => {
            if (doc.exists) {
                const userData = doc.data();
                console.log('Retrieved user data for dashboard:', userData);
                
                // Store user data in localStorage with defensive coding
                const userToStore = {
                    uid: userId,
                    username: userData.username || (fallbackData ? fallbackData.username : 'User ' + userId.substring(0, 6)),
                    email: userData.email || (fallbackData ? fallbackData.email : 'user@example.com'),
                    phone: userData.phone || currentPhoneNumber || (fallbackData ? fallbackData.phone : '+1234567890'),
                    verified: true,
                    lastLogin: new Date().toISOString()
                };
                    
                // Try to add createdAt if it exists
                try {
                    if (userData.createdAt) {
                        if (userData.createdAt.toDate) {
                            userToStore.createdAt = userData.createdAt.toDate().toISOString();
                        } else if (userData.createdAt.seconds) {
                            userToStore.createdAt = new Date(userData.createdAt.seconds * 1000).toISOString();
                        } else if (typeof userData.createdAt === 'string') {
                            userToStore.createdAt = userData.createdAt;
                        }
                    }
                } catch (e) {
                    console.error('Error processing createdAt:', e);
                    userToStore.createdAt = new Date().toISOString();
                }
                    
                localStorage.setItem('currentUser', JSON.stringify(userToStore));
                console.log('User data saved to localStorage:', userToStore);
                    
                // Clean up the pending login data
                localStorage.removeItem('pendingLoginUser');
            } else {
                console.warn('No user document found for ID:', userId);
                // Use fallback data or create minimum record
                const userToStore = fallbackData || {
                    uid: userId,
                    username: 'User ' + userId.substring(0, 6),
                    email: 'user@example.com',
                    phone: currentPhoneNumber || '+1234567890',
                    createdAt: new Date().toISOString(),
                    verified: true,
                    lastLogin: new Date().toISOString()
                };
                    
                localStorage.setItem('currentUser', JSON.stringify(userToStore));
                localStorage.removeItem('pendingLoginUser');
            }
                
            // Log auth event to Firestore with retry mechanism
            logAuthEventWithRetry(userId);
                
            // Now redirect to dashboard
            successMessage.textContent = 'Authentication successful! Redirecting to dashboard...';
                
            // Set a hard timeout to ensure we redirect no matter what
            const redirectTimeout = setTimeout(() => {
                console.log('Enforcing dashboard redirect after timeout');
                window.location.href = 'dashboard.html';
            }, 5000); // Force redirect after 5 seconds no matter what
                
            // Try the normal redirect first
            setTimeout(() => {
                console.log('Redirecting to dashboard...');
                try {
                    window.location.href = 'dashboard.html';
                    clearTimeout(redirectTimeout); // Clear the hard timeout if redirect works
                } catch (e) {
                    console.error('Error during redirect:', e);
                    // The hard timeout will still trigger if this fails
                }
            }, 1500);
        })
        .catch(error => {
            console.error('Error getting user data:', error);
                
            // Use fallback data or create minimal record
            const userToStore = fallbackData || {
                uid: userId,
                username: 'User ' + userId.substring(0, 6),
                email: 'user@example.com',
                phone: currentPhoneNumber || '+1234567890',
                createdAt: new Date().toISOString(),
                verified: true,
                lastLogin: new Date().toISOString(),
                dataSource: 'fallback'
            };
                
            localStorage.setItem('currentUser', JSON.stringify(userToStore));
            localStorage.removeItem('pendingLoginUser');
                
            // Try to log the auth event anyway
            logAuthEventWithRetry(userId);
                
            // Hard timeout for redirect
            const redirectTimeout = setTimeout(() => {
                console.log('Enforcing dashboard redirect after error timeout');
                window.location.href = 'dashboard.html';
            }, 5000);
                
            // Try normal redirect
            setTimeout(() => {
                console.log('Redirecting to dashboard with fallback data...');
                try {
                    window.location.href = 'dashboard.html';
                    clearTimeout(redirectTimeout);
                } catch (e) {
                    console.error('Error during redirect after data error:', e);
                }
            }, 1500);
        });
}

// Helper function to log auth event with retry
function logAuthEventWithRetry(userId, attempt = 0) {
    if (attempt > 3) {
        console.error('Failed to log auth event after multiple attempts');
        return;
    }
        
    db.collection('users').doc(userId)
        .collection('authHistory')
        .add({
            method: 'OTP and QR Code',
            status: 'Success',
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            userAgent: navigator.userAgent,
            localTime: new Date().toISOString()
        })
        .catch(err => {
            console.error(`Error logging auth event (attempt ${attempt + 1}):`, err);
            // Retry with exponential backoff
            setTimeout(() => logAuthEventWithRetry(userId, attempt + 1), 1000 * Math.pow(2, attempt));
        });
}

// Handle failed verification
function handleFailedVerification(errorMsg) {
    errorMessage.textContent = errorMsg;
    successMessage.textContent = '';
    document.getElementById('scan-status').textContent = 'Verification failed!';
    console.error('Verification failed:', errorMsg);
}

// Function for production mode Firestore verification
function checkFirestoreForVerification(sessionId, userId) {
    console.log('Checking Firestore for verification status of session:', sessionId, 'for user:', userId);
    
    // Add a timeout for the Firestore query
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Verification status check timeout')), 10000) // 10 second timeout
    );
    
    // Create the Firestore query
    const verificationPromise = db.collection('authSessions').doc(sessionId).get();
    
    // Race between the query and the timeout
    Promise.race([verificationPromise, timeoutPromise])
        .then((doc) => {
            if (!doc) {
                throw new Error('Invalid document result');
            }
            
            if (doc.exists) {
                const sessionData = doc.data();
                console.log('Verification session data:', sessionData);
                
                if (sessionData.status === 'approved') {
                    // QR code verified successfully
                    console.log('Verification approved! Proceeding with authentication');
                    handleSuccessfulVerification(userId);
                } else if (sessionData.status === 'denied') {
                    console.log('Verification denied by mobile device');
                    handleFailedVerification('Authentication denied from mobile device.');
                } else {
                    // Status is pending or not set
                    console.log('Verification status is still pending or unknown');
                    handleFailedVerification('Verification status unknown. Please try again.');
                }
            } else {
                console.error('No verification session found with ID:', sessionId);
                handleFailedVerification('Verification session not found. Please try again.');
            }
        })
        .catch((error) => {
            console.error('Error verifying QR code with Firestore:', error);
            
            // If this is a timeout error, try once more before giving up
            if (error.message === 'Verification status check timeout') {
                console.log('Timeout occurred, trying one more time...');
                // Wait 2 seconds and try again directly without timeout
                setTimeout(() => {
                    db.collection('authSessions').doc(sessionId).get()
                        .then((doc) => {
                            if (doc.exists && doc.data().status === 'approved') {
                                handleSuccessfulVerification(userId);
                            } else if (doc.exists && doc.data().status === 'denied') {
                                handleFailedVerification('Authentication denied from mobile device.');
                            } else {
                                handleFailedVerification('Verification timed out. Please try again.');
                            }
                        })
                        .catch((finalError) => {
                            console.error('Final error checking verification:', finalError);
                            handleFailedVerification('Error verifying QR code: ' + finalError.message);
                        });
                }, 2000);
            } else {
                handleFailedVerification('Error verifying QR code: ' + error.message);
            }
        });
}

// Function to resend OTP
function resendOTP() {
    // Get the phone number and email again
    const phone = phoneInput.value.trim();
    const email = emailInput.value.trim();
    
    // Update the current values
    currentPhoneNumber = phone;
    currentEmail = email;
    
    // Start the email authentication process again
    startEmailAuth(phone, email);
}
