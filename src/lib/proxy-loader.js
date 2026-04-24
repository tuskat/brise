import { proxyStore } from '../db/index.js';

export async function loadAllProxies() {
  return proxyStore.listAll();
}

export async function loadProxy(id) {
  return proxyStore.get(id);
}

export async function saveProxy(proxy) {
  return proxyStore.upsert(proxy);
}

export async function deleteProxy(id) {
  return proxyStore.delete(id);
}

export async function touchProxy(id) {
  proxyStore.touch(id);
}
