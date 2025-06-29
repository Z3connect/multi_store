// START OF FILE app.js (NEW VERSION WITH QUANTITY & STOCK MANAGEMENT)

// NEW DATA STRUCTURE: Using a Map for efficient quantity management.
let cart = new Map(); // Key: SKU, Value: { productData, quantity }
let skuToProductMap = new Map();
let html5QrCode;

// --- SETUP & SCANNING (Mostly Unchanged) ---
function loadProducts() {
  const select = document.getElementById("productSelect");
  select.innerHTML = '<option value="">-- Select for manual entry --</option>';
  db.collection("products").where("isActive", "==", true).get().then(snapshot => {
    snapshot.forEach(doc => {
      const product = doc.data();
      product.variants.forEach(variant => {
        if (variant.stock > 0) {
          const productData = { productId: doc.id, sku: variant.sku, name: `${product.name} (${variant.color}, ${variant.size})`, price: variant.sellingPrice, stock: variant.stock };
          skuToProductMap.set(variant.sku, productData);
          const option = document.createElement("option");
          option.value = variant.sku;
          option.text = `${productData.name} - ₹${productData.price}`;
          select.add(option);
        }
      });
    });
  });
}

function startScanner() {
  html5QrCode = new Html5Qrcode("reader");
  const config = { fps: 10, qrbox: { width: 250, height: 250 } };
  html5QrCode.start({ facingMode: "environment" }, config, (sku) => {
      document.getElementById('scanResult').innerText = `Scanned: ${sku}`;
      addToCartBySKU(sku, 1); // Scanner always adds quantity of 1
  }).catch(err => alert("Error starting camera: " + err));
}

function stopScanner() { if (html5QrCode) html5QrCode.stop(); }

// --- CORE CART LOGIC (Completely New) ---

// Adds a specified quantity of an item to the cart, checking stock first.
function addToCartBySKU(sku, quantity) {
  const productData = skuToProductMap.get(sku);
  if (!productData) {
    alert(`Product with SKU "${sku}" not found.`);
    return;
  }
  
  const itemInCart = cart.get(sku);
  const currentQtyInCart = itemInCart ? itemInCart.quantity : 0;
  
  if (currentQtyInCart + quantity > productData.stock) {
    alert(`Not enough stock for ${productData.name}. Only ${productData.stock - currentQtyInCart} more available.`);
    return;
  }
  
  if (itemInCart) {
    itemInCart.quantity += quantity;
  } else {
    cart.set(sku, { productData, quantity });
  }
  
  updateCartUI();
}

function addToCartManual() {
  const sku = document.getElementById("productSelect").value;
  const quantity = parseInt(document.getElementById("quantity").value, 10);
  if (sku && quantity > 0) {
    addToCartBySKU(sku, quantity);
  } else {
    alert("Please select a product and enter a valid quantity.");
  }
}

function increaseQuantity(sku) {
  addToCartBySKU(sku, 1);
}

function decreaseQuantity(sku) {
  const itemInCart = cart.get(sku);
  if (itemInCart) {
    itemInCart.quantity -= 1;
    if (itemInCart.quantity <= 0) {
      cart.delete(sku); // Remove item if quantity is 0 or less
    }
    updateCartUI();
  }
}

function setQuantity(sku, newQuantity) {
  const productData = skuToProductMap.get(sku);
  if (!productData) return; // Should not happen

  if (newQuantity > productData.stock) {
    alert(`Not enough stock. Maximum available is ${productData.stock}.`);
    updateCartUI(); // Re-render to reset the input to the old value
    return;
  }
  
  if (newQuantity <= 0) {
    cart.delete(sku);
  } else {
    cart.get(sku).quantity = newQuantity;
  }
  updateCartUI();
}

// Rewritten to render the new interactive cart
// START OF FILE app.js (Keep the top part of your file the same)

// ... (Keep all functions from loadProducts to setQuantity the same) ...

// --- REWRITE updateCartUI to handle discount calculation ---
function updateCartUI() {
  const cartList = document.getElementById("cartList");
  const subtotalEl = document.getElementById("subtotalAmount");
  const discountEl = document.getElementById("discountAmount");
  const grandTotalEl = document.getElementById("grandTotal");
  cartList.innerHTML = "";
  
  let subtotal = 0;
  
  if (cart.size === 0) {
    cartList.innerHTML = "<li>Cart is empty.</li>";
  } else {
    cart.forEach((item, sku) => {
      const li = document.createElement("li");
      li.className = 'cart-item';
      const itemTotal = item.productData.price * item.quantity;
      subtotal += itemTotal;
      
      li.innerHTML = `
        <span class="cart-item-name">${item.productData.name}</span>
        <div class="cart-item-qty">
          <button onclick="decreaseQuantity('${sku}')">-</button>
          <input type="number" value="${item.quantity}" min="1" onchange="setQuantity('${sku}', this.valueAsNumber)">
          <button onclick="increaseQuantity('${sku}')">+</button>
        </div>
        <span class="cart-item-price">₹${itemTotal.toFixed(2)}</span>
      `;
      cartList.appendChild(li);
    });
  }

  // --- NEW: Discount Calculation Logic ---
  const discountValue = parseFloat(document.getElementById('discountValue').value) || 0;
  const discountType = document.getElementById('discountType').value;
  let discountApplied = 0;

  if (discountType === 'percent') {
    discountApplied = (subtotal * discountValue) / 100;
  } else { // 'amount'
    discountApplied = discountValue;
  }
  
  // Ensure discount doesn't exceed subtotal
  if (discountApplied > subtotal) {
    discountApplied = subtotal;
  }

  const grandTotal = subtotal - discountApplied;

  subtotalEl.innerText = `₹${subtotal.toFixed(2)}`;
  discountEl.innerText = `₹${discountApplied.toFixed(2)}`;
  grandTotalEl.innerText = `₹${grandTotal.toFixed(2)}`;
}


// --- REWRITE generateAndSendBill to include payment and discount data ---
async function generateAndSendBill() {
  if (cart.size === 0) {
    alert("⚠️ Cart is empty!");
    return;
  }
  const customerName = document.getElementById('customerName').value.trim();
  const whatsappNumber = document.getElementById('whatsappNumber').value.trim();
  if (!customerName || !whatsappNumber) {
    alert("❌ Please enter Customer Name and WhatsApp Number.");
    return;
  }

  // --- Get new data from the form ---
  const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
  const discountValue = parseFloat(document.getElementById('discountValue').value) || 0;
  const discountType = document.getElementById('discountType').value;

  const counterRef = db.collection("counters").doc("billCounter");
  try {
    const newBillId = await db.runTransaction(async (transaction) => {
      // Stock update logic from previous version remains the same here...
      const counterDoc = await transaction.get(counterRef);
      if (!counterDoc.exists) throw "Bill counter document does not exist!";
      const lastBillNumber = counterDoc.data().lastBillNumber;
      const newBillNumber = lastBillNumber + 1;
      
      for (const [sku, item] of cart.entries()) {
        const productRef = db.collection("products").doc(item.productData.productId);
        const productDoc = await transaction.get(productRef);
        if (!productDoc.exists) throw `Product ${item.productData.name} not found!`;
        const productData = productDoc.data();
        const variantIndex = productData.variants.findIndex(v => v.sku === sku);
        if (variantIndex === -1) throw `Variant ${sku} not found!`;
        if (productData.variants[variantIndex].stock < item.quantity) { throw `Not enough stock for ${item.productData.name}.`; }
        productData.variants[variantIndex].stock -= item.quantity;
        transaction.update(productRef, { variants: productData.variants });
      }

      // --- Prepare Bill Data with NEW fields ---
      const subtotal = Array.from(cart.values()).reduce((sum, item) => sum + (item.productData.price * item.quantity), 0);
      let discountApplied = (discountType === 'percent') ? (subtotal * discountValue) / 100 : discountValue;
      if (discountApplied > subtotal) discountApplied = subtotal;
      const grandTotal = subtotal - discountApplied;
      
      const billItems = Array.from(cart.values()).map(item => ({...item.productData, quantity: item.quantity, returnedQty: 0 }));
      
      const newBillData = {
        billId: newBillNumber,
        items: billItems,
        subtotal: subtotal,
        discount: {
          value: discountValue,
          type: discountType,
          applied: discountApplied
        },
        grandTotal: grandTotal,
        paymentMethod: paymentMethod,
        totalRefundedAmount: 0, // <-- NEW
        netTotal: grandTotal,   // <-- NEW
        date: new Date(),
        customerName: customerName,
        whatsappNumber: whatsappNumber
        // 'returns' array will be added automatically on the first return
      };
      
      transaction.update(counterRef, { lastBillNumber: newBillNumber });
      const newBillRef = db.collection("bills").doc();
      transaction.set(newBillRef, newBillData);
      
      return { billId: newBillNumber, billData: newBillData }; // Return all data
    });

    // --- Create WhatsApp message with NEW details ---
    const { billId, billData } = newBillId; // Destructure the returned object
    let billText = `*Hi ${customerName},*\n\nThank you for your purchase! Here is your bill:\n\n*Invoice*\n*Bill ID: ${billId}*\n------------------------------------\n`;
    billData.items.forEach(item => {
      const itemTotal = item.price * item.quantity;
      billText += `${item.name}\n(Qty: ${item.quantity} x ₹${item.price.toFixed(2)}) = *₹${itemTotal.toFixed(2)}*\n`;
    });
    billText += `------------------------------------\n`;
    billText += `Subtotal: ₹${billData.subtotal.toFixed(2)}\n`;
    billText += `Discount: - ₹${billData.discount.applied.toFixed(2)}\n`;
    billText += `*GRAND TOTAL: ₹${billData.grandTotal.toFixed(2)}*\n`;
    billText += `Paid via: *${billData.paymentMethod}*\n\n`;
    billText += `Have a great day!`;

    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(billText)}`;
    window.open(whatsappUrl, '_blank');
    
    alert(`✅ Bill #${billId} created & stock updated!`);
    
    // Reset the entire form for the next transaction
    cart.clear();
    document.getElementById('discountValue').value = '';
    document.getElementById('payCash').checked = true;
    updateCartUI(); // This will also reset totals
    document.getElementById('customerName').value = '';
    document.getElementById('whatsappNumber').value = '';
    
  } catch (error) {
    console.error("Bill generation failed: ", error);
    alert("❌ Error generating bill. Transaction was rolled back. Stock was not updated. Reason: " + error);
  }
}



window.onload = loadProducts;