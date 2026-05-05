importScripts('ExtPay.js');
const extpay = ExtPay('watermark-express');
extpay.startBackground();

extpay.onPaid.addListener(() => {
  chrome.storage.local.set({ isPaid: true });
});

chrome.runtime.onInstalled.addListener(() => {
  extpay.getUser()
    .then(user => { if (user.paid) chrome.storage.local.set({ isPaid: true }); })
    .catch(() => {});
});

function openEditor() {
  chrome.tabs.create({ url: chrome.runtime.getURL('editor.html') });
}

chrome.action.onClicked.addListener(openEditor);

chrome.commands.onCommand.addListener((command) => {
  if (command === 'open-editor') openEditor();
});
