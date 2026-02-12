#!/usr/bin/env node
import webpush from "web-push";

const vapidKeys = webpush.generateVAPIDKeys();

console.log("VAPID keys generated!\n");
console.log("Add these to your .env file:\n");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
