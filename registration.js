// DOM elements
const registrationForm = document.getElementById('registration-form');
const phoneAuthDiv = document.getElementById('phone-auth');
const registerBtn = document.getElementById('register-btn');
const verifyBtn = document.getElementById('verify-btn');
const resendBtn = document.getElementById('resend-btn');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const emailInput = document.getElementById('email');
const phoneInput = document.getElementById('phone');
const verificationCodeInput = document.getElementById('verification-code');
const errorMessage = document.getElementById('error-message');
const successMessage = document.getElementById('success-message');

// Global variables
let verificationId = null;
let userData = null;

// Add event listeners
registerBtn.addEventListener('click', startRegistration);
verifyBtn.addEventListener('click', verifyOTP);
resendBtn.addEventListener('click', resendOTP);

// Function to start registration process
function startRegistration() {
    // Clear previous messages
    errorMessage.textContent = '';
    successMessage.textContent = '';

    // Validate form fields
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    const email = emailInput.value.trim();
    const phone = phoneInput.value.trim();

    if (!username || !password || !email || !phone) {
        errorMessage.textContent = 'Please fill all fields';
        return;
    }

    // Validate phone number format
    if (!phone.startsWith('+')) {
        errorMessage.textContent = 'Phone number must include country code (e.g., +91xxxxxxxxxx)';
        return;
    }

    // Store user data for later
    userData = {
        username: username,
        password: password, // Note: In a production app, you'd hash this password
        email: email,
        phone: phone,
        createdAt: new Date()
    };

    // Start phone number verification
    startPhoneAuth(phone);
}

// Function to initiate phone authentication
function startPhoneAuth(phoneNumber) {
    // Show loading message
    successMessage.textContent = 'Sending OTP...';

    // Set to true for local testing mode
    const testMode = true;
    
    if (testMode) {
        // Simulate OTP send success (for testing only)
        console.log('TEST MODE: Simulating OTP send for', phoneNumber);
        
        // Generate a random 6-digit OTP for testing
        const testOTP = Math.floor(100000 + Math.random() * 900000);
        console.log('=============================================');
        console.log('TEST MODE: Your OTP code is:', testOTP);
        console.log('=============================================');
        
        // Store the test OTP in a global variable for verification
        window.testOTP = testOTP;
        
        // Create a mock confirmation result object that strictly validates the specific OTP
        verificationId = {
            confirm: function(code) {
                // Only accept the specific test OTP that was displayed
                if (code === testOTP.toString()) {
                    return Promise.resolve({
                        user: { uid: 'test-user-' + Date.now() }
                    });
                } else {
                    return Promise.reject(new Error('Invalid OTP. Please enter the exact OTP shown in the console.'));
                }
            }
        };
        
        // Hide registration form and show OTP verification form
        registrationForm.classList.add('hidden');
        phoneAuthDiv.classList.remove('hidden');
        
        successMessage.textContent = 'TEST MODE: OTP sent successfully. Check console for OTP code (F12)';
        return;
    }

    // Real Firebase Authentication (for production)
    try {
        // Create a new invisible DIV for reCAPTCHA to render into
        const recaptchaContainer = document.createElement('div');
        recaptchaContainer.id = 'recaptcha-container';
        document.body.appendChild(recaptchaContainer);
        
        // Configure reCAPTCHA verification (more simplified)
        window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
            'size': 'invisible',
            'callback': function(response) {
                console.log('reCAPTCHA solved, proceeding with OTP verification');
            }
        });
        
        // Send verification code to the phone
        auth.signInWithPhoneNumber(phoneNumber, window.recaptchaVerifier)
            .then((confirmationResult) => {
                // SMS sent. Prompt user to type the code.
                window.confirmationResult = confirmationResult;
                
                // Hide registration form and show OTP verification form
                registrationForm.classList.add('hidden');
                phoneAuthDiv.classList.remove('hidden');
                
                successMessage.textContent = 'OTP sent successfully to your mobile number';
                console.log('OTP sent successfully');
            })
            .catch((error) => {
                // Error; SMS not sent
                console.error('Error sending OTP:', error);
                errorMessage.textContent = 'Error sending OTP: ' + error.message;
            });
    } catch (error) {
        console.error('Error initializing phone auth:', error);
        errorMessage.textContent = 'Error initializing OTP: ' + error.message;
    }
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

    // Test mode verification
    if (window.testOTP) {
        console.log('TEST MODE: Verifying OTP...');
        
        // Check if entered OTP matches the test OTP
        if (code === window.testOTP.toString()) {
            // Verification successful
            console.log('TEST MODE: OTP verified successfully!');
            successMessage.textContent = 'OTP verified successfully!';
            
            // Create a test user ID
            const testUserId = 'test-user-' + Date.now();
            console.log('TEST MODE: Created test user ID:', testUserId);
            
            // Save user data to Firestore or localStorage in test mode
            saveUserData(testUserId);
            return;
        } else {
            // OTP does not match
            console.error('TEST MODE: Invalid OTP entered.');
            errorMessage.textContent = 'Invalid OTP. Please enter the exact OTP shown in the console.';
            return;
        }
    }
    
    // Production mode (if we're not in test mode)
    // Get the confirmation result from window object
    const confirmationResult = window.confirmationResult;
    
    if (!confirmationResult) {
        errorMessage.textContent = 'OTP session expired. Please try again.';
        console.error('Confirmation result not found');
        return;
    }

    // Verify the OTP code
    confirmationResult.confirm(code)
        .then((result) => {
            // User signed in successfully
            const user = result.user;
            console.log('OTP verified successfully for user:', user.uid);
            
            // Save user data to Firestore
            saveUserData(user.uid);
        })
        .catch((error) => {
            // User couldn't sign in (bad verification code?)
            console.error('Error verifying OTP:', error);
            errorMessage.textContent = 'Invalid OTP. Please try again: ' + error.message;
        });
}

// Function to save user data to Firestore
function saveUserData(userId) {
    // Add the userId to the userData object
    userData.uid = userId; // Use 'uid' as the consistent identifier across the app
    
    // Keep userId for backward compatibility
    userData.userId = userId;
    
    console.log('Saving user data to Firestore:', userId, userData);
    
    // Create a data object that Firestore can handle (no complex objects)
    const firestoreData = {
        username: userData.username,
        password: userData.password, // Note: In production, this should be hashed
        email: userData.email,
        phone: userData.phone,
        uid: userId,
        userId: userId,
        createdAt: firebase.firestore.FieldValue.serverTimestamp() // Use server timestamp for consistency
    };
    
    // First save to localStorage to ensure we have the data regardless of Firestore success
    try {
        localStorage.setItem('currentUser', JSON.stringify({
            uid: userId,
            username: userData.username,
            email: userData.email,
            phone: userData.phone,
            createdAt: new Date().toISOString()
        }));
        console.log('Saved user data to localStorage');
    } catch (e) {
        console.error('Error saving to localStorage:', e);
    }
    
    // Now try to save to Firestore with retry mechanism
    const saveWithRetry = (retryCount = 0) => {
        db.collection('users').doc(userId).set(firestoreData, { merge: true })
            .then(() => {
                console.log('User data saved successfully to Firestore');
                successMessage.textContent = 'Registration successful! Redirecting to login...';
                
                // Redirect to login page after 1 second (reduced from 2 seconds)
                setTimeout(() => {
                    console.log('Redirecting to login page...');
                    window.location.href = 'login.html';
                }, 1000);
            })
            .catch((error) => {
                console.error(`Error saving user data to Firestore (attempt ${retryCount + 1}):`, error);
                
                if (retryCount < 3) {  // Try up to 3 times
                    console.log(`Retrying save operation (attempt ${retryCount + 2})...`);
                    setTimeout(() => saveWithRetry(retryCount + 1), 1000); // Wait 1 second before retry
                } else {
                    // After all retries, still proceed to login since we have localStorage data
                    errorMessage.textContent = 'Warning: Could not save to cloud database. Using local data instead.';
                    successMessage.textContent = 'Registration completed locally. Redirecting to login...';
                    
                    // Redirect anyway after all retries
                    setTimeout(() => {
                        console.log('Failed to save to Firestore after retries. Redirecting to login page anyway...');
                        window.location.href = 'login.html';
                    }, 1500);
                }
            });
    };
    
    // Start the save process with retry mechanism
    saveWithRetry();
}

// Function to resend OTP
function resendOTP() {
    // Clear previous verification ID
    verificationId = null;
    
    // Start the phone authentication process again
    startPhoneAuth(userData.phone);
}
