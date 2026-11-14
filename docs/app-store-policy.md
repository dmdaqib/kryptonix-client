# KryptonIX Client — App Store & Google Play Payment Policy Compliance

## 1. Executive Summary

**Application Name:** KryptonIX Client  
**Publisher:** KryptonIX Digital & AI Solutions  
**Official Website:** [https://kryptonix.digital/](https://kryptonix.digital/)  
**Primary Commerce Model:** B2B Professional Services & Custom Digital Engineering  
**Payment Integration:** Direct Merchant Payment Gateway (Razorpay — UPI, Credit/Debit Cards, Net Banking)  

This document sets out the regulatory, legal, and platform store compliance rationale demonstrating that **KryptonIX Client is exempt from Apple In-App Purchase (IAP) and Google Play Billing (GPB)**, and is fully authorized to use merchant payment gateway processing.

---

## 2. Apple App Store Review Guidelines

### 2.1 Applicable Exemption: Section 3.1.3(e) — Goods and Services Outside of the App

Apple App Store Review Guidelines explicitly declare in **Section 3.1.3(e)**:

> *"3.1.3(e) Goods and Services Outside of the App: If your app enables people to purchase goods or services that will be consumed outside of the app, you must use a purchase method other than in-app purchase to collect those payments, such as Apple Pay or ordinary credit card entry."*

### 2.2 Direct Application to KryptonIX Services

Every item, package, and custom solution purchasable or payable within the KryptonIX Client application represents **professional B2B services delivered and consumed entirely outside the application**:

1. **Website & E-Commerce Development:** Deployed to external third-party production hosting (AWS, Vercel, client on-premise infrastructure, custom domains).
2. **Mobile App Development:** Production source code repositories, app store provisioning profiles, standalone binaries handed over to the client's corporate organization.
3. **Custom Software & Business Automation:** Multi-tenant or enterprise backend APIs, enterprise CRM/ERP workflows, microservices, cloud database clusters operated outside the mobile application.
4. **Digital Marketing, SEO & Paid Ads (Google Ads, Meta Ads):** Campaign strategy, ad spend deployment, search engine indexation, conversion tracking executed across third-party ad networks and client web properties.
5. **AI Solutions & Salon/Gym Management Systems:** Off-app operational workflows, point-of-sale hardware integrations, third-party WhatsApp Business API connectors, staff terminal software.

The KryptonIX Client mobile application functions strictly as a **client account portal, communication hub, milestone tracker, and payment coordination terminal** for external professional services. Nothing purchased is unlocked or consumed digitally inside the mobile app sandbox.

---

## 3. Google Play Developer Policy Compliance

### 3.1 Applicable Rule: Google Play Payments Policy (Exemption for Physical Goods & Off-App Services)

Under the Google Play Developer Policy regarding Payments:

> *"Google Play's billing system must be used for in-app purchases of digital content, services, and subscriptions that are consumed inside the app. Developers are NOT required to use Google Play's billing system when the transaction involves physical goods or services that are consumed outside the app."*

### 3.2 Professional B2B Service Exemption

- **Off-App Consumption:** KryptonIX deliverables (source code, Figma assets, production DNS configurations, ad campaign management, consulting hours) are consumed in the client's real-world business operations.
- **Milestone & Instalment Terms:** B2B commercial contracts operate under customized milestone payments (e.g. 50% advance, 50% upon deliverable sign-off), commercial tax invoicing (18% Indian GST with GSTIN input credit), and client acceptance protocols that are fundamentally incompatible with fixed consumer digital microtransactions.
- **Direct Merchant Settlement:** Merchant payments flow directly through authorized PCI-DSS certified gateways (Razorpay) with statutory tax invoices (`KX-INV-...`) and payment receipts (`KX-RCPT-...`).

---

## 4. App Reviewer Guidance & Test Credentials

### 4.1 How to Verify During App Review

When testing the application in App Store Review or Google Play Console review:

1. **Service Catalogue Discovery:** Reviewers can explore all 13 commercial categories, service package breakdowns, deliverables, roadmap stages, and FAQs without entering payment information.
2. **Quotation / Custom Proposal:** Reviewers can submit custom project enquiries via `/(app)/enquiry/new` without financial commitment.
3. **Sandbox Payment Flow:** 
   - When proceeding to checkout on an invoice in testing/staging mode, the app invokes the secure payment flow.
   - For review sandboxing, the backend generates test orders (`order_sbx_...`) and permits mock verification so reviewers can verify the complete roundtrip (invoice status transitions, receipt generation, project milestone activation) without requiring real payment instruments or charges.
4. **In-App Deliverable Review:** Deliverables uploaded by staff (e.g., design previews, code handover documentation) are inspected by the client in `/(app)/projects/[id]` and can be approved or revised.

### 4.2 Reviewer Note Template

> *"Dear App Review Team,  
> KryptonIX Client is a B2B project portal for clients of KryptonIX Digital & AI Solutions. The services available for purchase in this application (custom software engineering, website development, enterprise business automation, and digital marketing campaigns) are professional services delivered and consumed entirely outside the application in our clients' real-world business infrastructure. Under Apple App Store Guideline 3.1.3(e) / Google Play Payments Policy, these off-app professional services qualify for direct merchant gateway payment processing. Sandbox payment simulation is supported for testing without real charges."*
