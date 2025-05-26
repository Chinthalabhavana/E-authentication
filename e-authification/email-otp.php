<?php
// Email-based OTP system
header('Content-Type: application/json');

// Start session to store OTP information
session_start();

// Get the request method
$request_method = $_SERVER['REQUEST_METHOD'];

// Handle different API endpoints
$endpoint = isset($_GET['endpoint']) ? $_GET['endpoint'] : '';

// Send OTP endpoint
if ($endpoint === 'send-otp' && $request_method === 'POST') {
    // Get the phone number and email from the request
    $data = json_decode(file_get_contents('php://input'), true);
    $phone_number = isset($data['phoneNumber']) ? $data['phoneNumber'] : '';
    $email = isset($data['email']) ? $data['email'] : '';
    
    if (empty($phone_number) || empty($email)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Phone number and email are required']);
        exit;
    }
    
    // Generate a random 6-digit OTP
    $otp = rand(100000, 999999);
    
    // Store OTP in session with timestamp
    $_SESSION['otp_data'] = [
        'phone' => $phone_number,
        'email' => $email,
        'otp' => $otp,
        'timestamp' => time(),
        'attempts' => 0
    ];
    
    // Prepare email
    $to = $email;
    $subject = "Your Authentication OTP Code";
    $message = "
    <html>
    <head>
        <title>Your OTP Code</title>
    </head>
    <body>
        <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;'>
            <h2 style='color: #4285f4;'>Authentication Code</h2>
            <p>Your one-time password (OTP) for authentication is:</p>
            <div style='background-color: #f5f5f5; padding: 15px; border-radius: 5px; text-align: center; font-size: 24px; letter-spacing: 5px; font-weight: bold;'>
                $otp
            </div>
            <p style='margin-top: 20px;'>This code will expire in 10 minutes.</p>
            <p style='color: #777; font-size: 12px; margin-top: 30px;'>If you did not request this code, please ignore this email.</p>
        </div>
    </body>
    </html>
    ";
    
    // Set content-type header for sending HTML email
    $headers = "MIME-Version: 1.0" . "\r\n";
    $headers .= "Content-type:text/html;charset=UTF-8" . "\r\n";
    $headers .= "From: E-Authentication <noreply@yourdomain.com>" . "\r\n";
    
    try {
        // Send email
        $mail_sent = mail($to, $subject, $message, $headers);
        
        if ($mail_sent) {
            // Log the OTP for debugging (remove in production)
            error_log("OTP sent to $email: $otp");
            
            echo json_encode(['success' => true, 'message' => 'OTP sent successfully to your email']);
        } else {
            throw new Exception('Failed to send email');
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to send OTP: ' . $e->getMessage()]);
    }
}
// Verify OTP endpoint
else if ($endpoint === 'verify-otp' && $request_method === 'POST') {
    // Get the phone number and OTP from the request
    $data = json_decode(file_get_contents('php://input'), true);
    $phone_number = isset($data['phoneNumber']) ? $data['phoneNumber'] : '';
    $user_otp = isset($data['otp']) ? $data['otp'] : '';
    
    if (empty($phone_number) || empty($user_otp)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Phone number and OTP are required']);
        exit;
    }
    
    // Check if OTP data exists in session
    if (!isset($_SESSION['otp_data'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'No OTP was sent or session expired']);
        exit;
    }
    
    $otp_data = $_SESSION['otp_data'];
    
    // Check if the phone number matches
    if ($otp_data['phone'] !== $phone_number) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Phone number does not match']);
        exit;
    }
    
    // Check if OTP has expired (10 minutes)
    $expiry_time = 10 * 60; // 10 minutes in seconds
    if (time() - $otp_data['timestamp'] > $expiry_time) {
        // Clear the OTP data
        unset($_SESSION['otp_data']);
        
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'OTP has expired. Please request a new one']);
        exit;
    }
    
    // Increment attempt counter
    $_SESSION['otp_data']['attempts']++;
    
    // Check if too many attempts (max 3)
    if ($_SESSION['otp_data']['attempts'] > 3) {
        // Clear the OTP data
        unset($_SESSION['otp_data']);
        
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Too many failed attempts. Please request a new OTP']);
        exit;
    }
    
    // Check if OTP matches
    if ($otp_data['otp'] == $user_otp) {
        // OTP verified successfully, clear the data
        unset($_SESSION['otp_data']);
        
        echo json_encode(['success' => true, 'message' => 'OTP verified successfully']);
    } else {
        $attempts_left = 3 - $_SESSION['otp_data']['attempts'];
        echo json_encode([
            'success' => false, 
            'message' => "Invalid OTP. $attempts_left attempts remaining"
        ]);
    }
}
// Invalid endpoint
else {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Invalid endpoint']);
}
?>
