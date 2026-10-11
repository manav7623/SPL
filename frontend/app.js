// SPL 2026 Frontend Application Logic

document.addEventListener('DOMContentLoaded', () => {
  initAccordions();
  initFormHandler();
});

// Toast notification helper
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast-wrapper');
  const icon = document.getElementById('toast-icon');
  const msgText = document.getElementById('toast-message');

  msgText.innerText = message;
  toast.className = `toast-notification show ${type}`;

  if (type === 'success') {
    icon.className = 'fa-solid fa-circle-check';
  } else {
    icon.className = 'fa-solid fa-triangle-exclamation';
  }

  setTimeout(() => {
    toast.classList.remove('show');
  }, 4000);
}

// Accordion Collapsibles
function initAccordions() {
  const accordions = document.querySelectorAll('.accordion');
  accordions.forEach(acc => {
    const header = acc.querySelector('.accordion-header');
    header.addEventListener('click', () => {
      // Close other accordions
      accordions.forEach(other => {
        if (other !== acc && other.classList.contains('active')) {
          other.classList.remove('active');
        }
      });
      acc.classList.toggle('active');
    });
  });
}

// Registration Form Handler
function initFormHandler() {
  const form = document.getElementById('registration-form');
  const submitBtn = document.getElementById('submit-btn');

  // Input validation utility
  function validateField(input, groupSelector) {
    const group = document.querySelector(groupSelector);
    if (!input.checkValidity()) {
      group.classList.add('has-error');
      return false;
    } else {
      group.classList.remove('has-error');
      return true;
    }
  }

  // Clear errors on input
  const textInputs = form.querySelectorAll('input[type="text"], input[type="tel"], input[type="number"]');
  textInputs.forEach(input => {
    input.addEventListener('input', () => {
      const group = input.closest('.form-group');
      if (group) group.classList.remove('has-error');
    });
  });

  // Restrict Mobile and T-shirt Number inputs to numeric values only
  const mobileInput = document.getElementById('mobile');
  mobileInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, '');
  });

  const tshirtNumberInput = document.getElementById('tshirt_number');
  tshirtNumberInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, '');
  });

  // Clear errors for radio options on change
  const radios = form.querySelectorAll('input[type="radio"]');
  radios.forEach(radio => {
    radio.addEventListener('change', () => {
      const group = radio.closest('.form-group');
      if (group) group.classList.remove('has-error');
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Check custom validity
    let isValid = true;

    // Validate inputs
    isValid = validateField(document.getElementById('name'), '#group-name') && isValid;
    
    const mobileInput = document.getElementById('mobile');
    isValid = validateField(mobileInput, '#group-mobile') && isValid;

    // Validate Playing Role (radios)
    const roleChecked = form.querySelector('input[name="playing_role"]:checked');
    const roleGroup = document.querySelector('#group-playing_role');
    if (!roleChecked) {
      roleGroup.classList.add('has-error');
      isValid = false;
    } else {
      roleGroup.classList.remove('has-error');
    }

    // Validate T-Shirt Size (radios)
    const sizeChecked = form.querySelector('input[name="tshirt_size"]:checked');
    const sizeGroup = document.querySelector('#group-tshirt_size');
    if (!sizeChecked) {
      sizeGroup.classList.add('has-error');
      isValid = false;
    } else {
      sizeGroup.classList.remove('has-error');
    }

    isValid = validateField(document.getElementById('tshirt_number'), '#group-tshirt_number') && isValid;
    isValid = validateField(document.getElementById('tshirt_name'), '#group-tshirt_name') && isValid;

    if (!isValid) {
      showToast('Please correct the validation errors in the form.', 'error');
      // Scroll to the first error group
      const firstError = document.querySelector('.has-error');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    // Capture values
    const name = document.getElementById('name').value.trim();
    const mobile = mobileInput.value.trim();
    const playing_role = roleChecked.value;
    const tshirt_size = sizeChecked.value;
    const tshirt_number = document.getElementById('tshirt_number').value.trim();
    const tshirt_name = document.getElementById('tshirt_name').value.trim().toUpperCase();

    // Disable button & show loading state
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing Checkout...';

    try {
      // Step 1: Create order on backend
      const response = await fetch('/api/register/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          mobile,
          playing_role,
          tshirt_size,
          tshirt_number,
          tshirt_name
        })
      });

      const orderData = await response.json();

      if (!response.ok || !orderData.success) {
        throw new Error(orderData.error || 'Failed to create order');
      }

      // Step 2: Proceed with Payment depending on Mode
      if (orderData.isMock) {
        launchMockPayment(orderData.orderId, name, mobile, playing_role, tshirt_size, tshirt_number, tshirt_name);
      } else {
        launchRazorpayPayment(orderData, name, mobile, playing_role, tshirt_size, tshirt_number, tshirt_name);
      }

    } catch (err) {
      console.error(err);
      showToast(err.message || 'Server error. Please try again.', 'error');
      resetSubmitButton();
    }
  });

  function resetSubmitButton() {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fa-solid fa-credit-card"></i> Pay ₹500 & Register';
  }

  // Launch real Razorpay Checkout popup
  function launchRazorpayPayment(orderData, name, mobile, role, size, tshirtNo, tshirtName) {
    const options = {
      key: orderData.keyId,
      amount: orderData.amount,
      currency: 'INR',
      name: 'SPL 2026',
      description: 'Player Entry & kit Registration Fee',
      image: 'https://placehold.co/100x100/12d36d/070f0b?text=SPL',
      order_id: orderData.orderId,
      handler: function (response) {
        // Send payment response to backend verification
        verifyPayment({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
          name,
          mobile,
          role,
          size,
          tshirtNo,
          tshirtName
        });
      },
      prefill: {
        name: name,
        contact: mobile
      },
      notes: {
        playing_role: role,
        tshirt_details: `Size: ${size}, Name: ${tshirtName}, No: ${tshirtNo}`
      },
      theme: {
        color: '#12d36d' // Primary Grass Green
      },
      modal: {
        ondismiss: function () {
          showToast('Payment cancelled by user.', 'error');
          resetSubmitButton();
        }
      }
    };

    const rzp = new Razorpay(options);
    rzp.open();
  }

  // Launch Simulated (Mock) checkout dialog
  function launchMockPayment(orderId, name, mobile, role, size, tshirtNo, tshirtName) {
    const backdrop = document.getElementById('mock-payment-backdrop');
    const displayOrderId = document.getElementById('mock-order-id');
    const btnSuccess = document.getElementById('mock-pay-success');
    const btnFail = document.getElementById('mock-pay-fail');
    const btnCancel = document.getElementById('mock-pay-cancel');

    displayOrderId.innerText = orderId;
    backdrop.classList.add('show');

    // Remove old listeners to avoid multiple attachments
    const newBtnSuccess = btnSuccess.cloneNode(true);
    const newBtnFail = btnFail.cloneNode(true);
    const newBtnCancel = btnCancel.cloneNode(true);
    
    btnSuccess.replaceWith(newBtnSuccess);
    btnFail.replaceWith(newBtnFail);
    btnCancel.replaceWith(newBtnCancel);

    // Mock signature verification parameters
    newBtnSuccess.addEventListener('click', () => {
      backdrop.classList.remove('show');
      const mockPayId = `pay_mock_${Math.random().toString(36).substr(2, 9)}`;
      const mockSignature = `sig_mock_${Math.random().toString(36).substr(2, 12)}`;

      verifyPayment({
        razorpay_order_id: orderId,
        razorpay_payment_id: mockPayId,
        razorpay_signature: mockSignature,
        name,
        mobile,
        role,
        size,
        tshirtNo,
        tshirtName
      });
    });

    newBtnFail.addEventListener('click', () => {
      backdrop.classList.remove('show');
      showToast('Payment declined by bank simulation.', 'error');
      resetSubmitButton();
    });

    newBtnCancel.addEventListener('click', () => {
      backdrop.classList.remove('show');
      showToast('Checkout session aborted.', 'error');
      resetSubmitButton();
    });
  }

  // Verify payment on server
  async function verifyPayment(paymentDetails) {
    try {
      const verifyResponse = await fetch('/api/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          razorpay_order_id: paymentDetails.razorpay_order_id,
          razorpay_payment_id: paymentDetails.razorpay_payment_id,
          razorpay_signature: paymentDetails.razorpay_signature
        })
      });

      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok || !verifyData.success) {
        throw new Error(verifyData.error || 'Payment verification failed');
      }

      // Success - Display confirmation card
      showToast('Registration Confirmed Successfully!');
      renderConfirmation(verifyData.registrationId, paymentDetails);

    } catch (error) {
      console.error(error);
      showToast(error.message || 'Payment confirmation failed. Check console for details.', 'error');
      resetSubmitButton();
    }
  }

  // Populate confirmation card
  function renderConfirmation(registrationId, p) {
    document.getElementById('form-section').style.display = 'none';
    document.getElementById('banner').style.display = 'none';
    
    const confirmSection = document.getElementById('confirmation-section');
    confirmSection.style.display = 'block';

    document.getElementById('confirmed-reg-id').innerText = registrationId;
    document.getElementById('conf-name').innerText = p.name;
    document.getElementById('conf-mobile').innerText = p.mobile;
    document.getElementById('conf-role').innerText = p.role;
    document.getElementById('conf-tshirt').innerText = `Size ${p.size} (#${p.tshirtNo} - ${p.tshirtName})`;
    document.getElementById('conf-pay-id').innerText = p.razorpay_payment_id;

    // Scroll back to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
