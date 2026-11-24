// Reference artwork is restricted to the two seeded catalogue stores.
// Merchant-uploaded artwork always takes precedence.
const referenceArtwork = {
  '82040807-07b8-4d39-a188-6f36259da1e1': {
    cover: 'store-casa-cover.jpg', avatar: 'store-casa-profile.jpg', coverPosition: '50% 48%', avatarPosition: '50% 55%'
  },
  'd84c175d-39b9-4d65-bea2-16a86ab7e3d1': {
    cover: 'store-mercearia-cover.jpg', avatar: 'store-mercearia-profile.jpg', coverPosition: '50% 50%', avatarPosition: '50% 50%'
  }
};
export function resolveStoreArtwork(store) {
  const reference = store.isTest ? referenceArtwork[store.id] : null;
  return {
    cover: store.bannerUrl || (reference ? '/' + reference.cover : ''),
    avatar: store.logoUrl || (reference ? '/' + reference.avatar : ''),
    coverPosition: store.bannerUrl ? '50% 50%' : reference?.coverPosition || '50% 50%',
    avatarPosition: store.logoUrl ? '50% 50%' : reference?.avatarPosition || '50% 50%',
    avatarFit: store.logoUrl ? 'contain' : 'cover'
  };
}
