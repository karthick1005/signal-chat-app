/**
 * Test script to debug AES key generation and validation
 */

// Test the key generation process
function testKeyGeneration() {
  console.log('🧪 Testing AES key generation...');
  
  // Generate key exactly like WhatsAppGroupService does
  const keyBytes = crypto.getRandomValues(new Uint8Array(32));
  console.log('Generated key bytes length:', keyBytes.length);
  console.log('Generated key bytes:', keyBytes);
  
  const base64Key = btoa(String.fromCharCode(...keyBytes));
  console.log('Base64 key:', base64Key);
  console.log('Base64 key length:', base64Key.length);
  
  // Test decoding back to verify size
  try {
    const binaryString = atob(base64Key);
    console.log('Decoded binary string length:', binaryString.length);
    
    const decodedBytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      decodedBytes[i] = binaryString.charCodeAt(i);
    }
    console.log('Decoded bytes length:', decodedBytes.length);
    console.log('Decoded bytes:', decodedBytes);
    
    // Test ArrayBuffer conversion
    const arrayBuffer = decodedBytes.buffer;
    console.log('ArrayBuffer byte length:', arrayBuffer.byteLength);
    
    // Test crypto key import
    crypto.subtle.importKey("raw", arrayBuffer, { name: "AES-GCM" }, false, ["encrypt"])
      .then(key => {
        console.log('✅ Successfully imported crypto key:', key);
      })
      .catch(error => {
        console.error('❌ Failed to import crypto key:', error);
      });
      
  } catch (error) {
    console.error('❌ Error during key validation:', error);
  }
}

// Test base64 validation
function isValidBase64(str) {
  try {
    return btoa(atob(str)) === str;
  } catch {
    return false;
  }
}

function testBase64Validation() {
  console.log('🧪 Testing base64 validation...');
  
  const keyBytes = crypto.getRandomValues(new Uint8Array(32));
  const base64Key = btoa(String.fromCharCode(...keyBytes));
  
  console.log('Is valid base64:', isValidBase64(base64Key));
  console.log('Test invalid base64:', isValidBase64('invalid!!!'));
}

// Run tests
testKeyGeneration();
testBase64Validation();

export { testKeyGeneration, testBase64Validation };
