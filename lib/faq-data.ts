/**
 * Sample FAQ for a fictional shop, "Fernbrook Garden Supply". Everything here is invented for the demo.
 * The assistant may only answer from entries like these.
 */
export interface FaqSeed {
  category: string;
  question: string;
  answer: string;
  keywords?: string;
}

export const FAQ_SEED: FaqSeed[] = [
  { category: "Shipping", question: "How much does shipping cost?", answer: "Standard shipping is $6.50 per order. Orders over $60 ship free within the continental U.S.", keywords: "postage delivery fee free shipping price" },
  { category: "Shipping", question: "How long does delivery take?", answer: "Most orders arrive in 3 to 5 business days. Live plants ship Monday to Wednesday so they never sit in a warehouse over a weekend.", keywords: "arrive arrival days transit how fast when will" },
  { category: "Shipping", question: "Do you ship outside the U.S.?", answer: "Not yet. We ship to the 48 contiguous states, and to Alaska and Hawaii for dry goods only.", keywords: "deliver international overseas abroad canada europe country" },
  { category: "Shipping", question: "Can I track my order?", answer: "Yes. You get a tracking link by email when your order ships. You can also look up an order on the Track Order page with your order number and email.", keywords: "tracking number where is my order status package" },
  { category: "Shipping", question: "Can I change or cancel my order?", answer: "You can change or cancel within 2 hours of ordering, before it goes to the packing team. After that, contact us and we will try, but we cannot promise.", keywords: "modify edit address cancel order stop" },
  { category: "Returns", question: "What is your return policy?", answer: "Tools, pots and supplies can be returned within 30 days in original condition. Return shipping is free for defective items.", keywords: "send back exchange policy return window" },
  { category: "Returns", question: "Can I return a live plant?", answer: "Live plants are covered by our 14 day health guarantee. If a plant arrives damaged or dies within 14 days, send a photo and we will replace it or refund you.", keywords: "dead plant died damaged replacement guarantee" },
  { category: "Returns", question: "How do I start a return?", answer: "Email support with your order number and a photo if the item is damaged. We reply within one business day with a prepaid label.", keywords: "return label rma send back begin" },
  { category: "Returns", question: "When will I get my refund?", answer: "Refunds go back to your original payment method within 5 business days of us receiving the return.", keywords: "money back refund time reimbursement" },
  { category: "Orders", question: "What payment methods do you accept?", answer: "Visa, Mastercard, American Express, Apple Pay and Google Pay. We do not accept checks or cash on delivery.", keywords: "pay credit card paypal apple pay google pay visa" },
  { category: "Orders", question: "Do you offer gift cards?", answer: "Yes. Digital gift cards from $10 to $200 are emailed instantly and never expire.", keywords: "gift card voucher present" },
  { category: "Orders", question: "Do you have a discount code or sale?", answer: "Subscribe to our newsletter for 10% off your first order. Seasonal sales are announced there first.", keywords: "coupon promo code discount sale offer deal" },
  { category: "Orders", question: "My order arrived with missing items", answer: "Sorry about that. Email support with your order number and a photo of the packing slip, and we will ship the missing items free.", keywords: "missing item incomplete wrong item short shipped" },
  { category: "Orders", question: "Is my payment information secure?", answer: "Payments are handled by Stripe. We never see or store your full card number.", keywords: "safe security card data privacy stripe" },
  { category: "Plant care", question: "How often should I water succulents?", answer: "Water succulents every 2 to 3 weeks, only when the soil is fully dry. In winter, cut back to once a month.", keywords: "watering cactus succulent water schedule" },
  { category: "Plant care", question: "How much sun do tomato plants need?", answer: "Tomatoes need at least 6 to 8 hours of direct sun a day. In very hot climates, give them afternoon shade.", keywords: "sunlight light tomato vegetable garden" },
  { category: "Plant care", question: "What soil should I use for potted herbs?", answer: "Use a light potting mix with good drainage. Mix in a handful of perlite per pot, and make sure every pot has drainage holes.", keywords: "potting mix basil mint rosemary herb container soil" },
  { category: "Plant care", question: "When is the best time to plant bulbs?", answer: "Plant spring-flowering bulbs in autumn, about 6 weeks before the ground freezes, at a depth of about three times the bulb's height.", keywords: "tulip daffodil crocus autumn fall planting season" },
  { category: "Plant care", question: "Why are my plant's leaves turning yellow?", answer: "Yellow leaves are most often caused by overwatering. Check that the soil dries between waterings and that the pot drains. If it continues, send us a photo.", keywords: "yellowing leaves leaf wilting overwatered sick plant" },
  { category: "About us", question: "What are your opening hours?", answer: "Our support team answers email Monday to Friday, 9am to 5pm Central. The online shop is open all day, every day.", keywords: "hours open closed support time when available" },
  { category: "About us", question: "Do you have a physical store?", answer: "No, Fernbrook is online only. Our warehouse is in Ohio and is not open to visitors.", keywords: "shop location address visit pickup warehouse" },
  { category: "About us", question: "How can I contact a person?", answer: "Email support@fernbrook.example and we reply within one business day. This is a demo, so no real inbox is monitored.", keywords: "human agent phone call email talk to someone customer service" },
  { category: "About us", question: "Do you sell wholesale?", answer: "Yes, for orders of 50 or more items. Email wholesale@fernbrook.example with what you need.", keywords: "bulk trade reseller business large order" },
  { category: "About us", question: "Are your seeds organic?", answer: "Our herb and vegetable seeds are certified organic. Flower seeds are untreated but not certified.", keywords: "organic seeds non gmo heirloom" },
];
