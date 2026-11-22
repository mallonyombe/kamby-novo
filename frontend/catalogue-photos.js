// Retired catalogue artwork remains in storage for history; resolve only those exact paths.
const photographs = {
 '6618ee6f-cf90-40ac-b34b-18becb8bc152':'caneca',
 'b3805ff9-89e9-4a94-afea-43ba52e869d7':'caneca-alta',
 'dc56ef3b-46b1-4017-96ee-04f69f1791cc':'jarro',
 'ad9f9488-b0d9-46f8-85ea-307b0694a344':'tenis',
 '0583af85-1ffe-42b1-9609-989ea77d159d':'auriculares',
 'ff627267-cb53-44b2-bdff-5b9e61bc5e3b':'arroz',
 '1824a802-2c67-44d6-89f3-8bbf6098f796':'oleo',
 'a0f7ae50-b946-440a-8acb-a5429c71890b':'acucar',
 'ad9b0aa3-8a3a-46ad-9584-32f2003fe2c6':'cafe'
};
export function cataloguePhoto(path='') {
 const match=String(path).match(/^(?:5fbe93ee-5913-460f-bf14-4ede0fb4868c\/(?:82040807-07b8-4d39-a188-6f36259da1e1|d84c175d-39b9-4d65-bea2-16a86ab7e3d1)\/([a-f0-9-]+)\/gallery-[01]\.png|5f74ec40-a59b-479f-960b-dad196188b5e\/82040807-07b8-4d39-a188-6f36259da1e1\/(b3805ff9-89e9-4a94-afea-43ba52e869d7)\/photo\.png)$/);
 const name=match&&photographs[match[1]||match[2]];
 return name?new URL('./catalogue-'+name+'.jpg',import.meta.url).href:'';
}
