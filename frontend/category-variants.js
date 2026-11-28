export const variantAxes={
  volume:{label:'Volume (ml, L)',examples:['330 ml','500 ml','1 L','1,5 L','5 L','20 L']},
  weight:{label:'Peso (g, kg)',examples:['250 g','500 g','1 kg','2 kg','5 kg','10 kg']},
  size:{label:'Tamanho',examples:['XS','S','M','L','XL','XXL']},
  length:{label:'Comprimento (cm, m)',examples:['10 cm','50 cm','1 m','2 m','5 m']}
};

export function categorySearchKey(value){
  return value.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('pt').trim();
}
