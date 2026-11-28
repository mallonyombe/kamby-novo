export const variantAxes={
  volume:{label:'Volume',examples:['330 ml','500 ml','1 L','1,5 L','5 L','20 L']},
  small_volume:{label:'Volume',examples:['15 ml','30 ml','50 ml','75 ml','100 ml','150 ml','250 ml']},
  weight:{label:'Peso',examples:['250 g','500 g','1 kg','2 kg','5 kg','10 kg']},
  size:{label:'Tamanho',examples:['XS','S','M','L','XL','XXL']},
  apparel_size:{label:'Tamanho da roupa',examples:['XS','S','M','L','XL','XXL','3XL']},
  waist_size:{label:'Tamanho da cintura (W)',examples:['W24','W26','W28','W30','W32','W34','W36','W38','W40']},
  shoe_size:{label:'Número do calçado (EU)',examples:['35','36','37','38','39','40','41','42','43','44','45','46']},
  kids_apparel_size:{label:'Tamanho da roupa infantil',examples:['0–3 meses','3–6 meses','6–12 meses','1–2 anos','3–4 anos','5–6 anos','7–8 anos','9–10 anos']},
  kids_shoe_size:{label:'Número do calçado infantil (EU)',examples:['20','22','24','26','28','30','32','34']},
  bra_size:{label:'Tamanho do soutien',examples:['75A','75B','80B','80C','85B','85C','90C','95D']},
  ring_size:{label:'Tamanho do anel (EU)',examples:['48','50','52','54','56','58','60','62','64']},
  length:{label:'Comprimento',examples:['10 cm','50 cm','1 m','2 m','5 m']},
  capacity:{label:'Capacidade de armazenamento',examples:['32 GB','64 GB','128 GB','256 GB','512 GB','1 TB','2 TB']},
  dimensions:{label:'Dimensões',examples:['30 × 30 cm','40 × 40 cm','50 × 70 cm','60 × 60 cm']},
  power:{label:'Potência',examples:['5 W','9 W','12 W','15 W','20 W','30 W']},
  color:{label:'Cor',examples:['Preto','Branco','Azul','Verde','Vermelho','Cinza']},
  pack:{label:'Quantidade por embalagem',examples:['1 unidade','2 unidades','3 unidades','6 unidades','12 unidades']},
  diaper_size:{label:'Tamanho da fralda',examples:['Recém-nascido','1','2','3','4','5','6']},
  bed_size:{label:'Tamanho da cama',examples:['Individual','Casal','Queen','King']}
};

export function categorySearchKey(value){
  return value.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('pt').trim();
}
