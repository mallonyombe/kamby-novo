begin;
update public.kg_stores set name='Casa & Estilo',description='Artigos para casa, moda e electrónica. Encontra peças para o dia a dia e para renovar o teu espaço.' where id='82040807-07b8-4d39-a188-6f36259da1e1' and is_test=true;
update public.kg_stores set name='Mercearia do Bairro',description='Arroz, óleo, açúcar e café para a tua despensa. Escolhe a quantidade e prepara o teu pedido.' where id='d84c175d-39b9-4d65-bea2-16a86ab7e3d1' and is_test=true;
update public.kg_products p set title=v.title,description=v.description,image_url='https://kamby-novo-orbion.mallonyombe123.chatgpt.site/catalogue-'||v.photo||'.jpg'
from (values
('6618ee6f-cf90-40ac-b34b-18becb8bc152'::uuid,'Caneca de cerâmica Cora','Caneca branca de cerâmica para café, chá ou outras bebidas. Disponível em 350 ml e 500 ml.','caneca'),
('b3805ff9-89e9-4a94-afea-43ba52e869d7'::uuid,'Caneca de cerâmica 500 ml','Caneca branca de cerâmica com capacidade de 500 ml.','caneca-alta'),
('dc56ef3b-46b1-4017-96ee-04f69f1791cc'::uuid,'Jarro decorativo Noma','Cerâmica de acabamento claro. Escolhe a altura de 22 cm ou 30 cm.','jarro'),
('ad9f9488-b0d9-46f8-85ea-307b0694a344'::uuid,'Ténis desportivos Leve','Ténis com detalhes em azul e branco. Selecciona o teu tamanho para consultar o preço e a disponibilidade.','tenis'),
('0583af85-1ffe-42b1-9609-989ea77d159d'::uuid,'Auriculares sem fios Duo','Auriculares sem fios com caixa de carregamento.','auriculares'),
('ff627267-cb53-44b2-bdff-5b9e61bc5e3b'::uuid,'Arroz de grão longo','Arroz de grão longo. Disponível em embalagens de 1 kg, 5 kg e 10 kg.','arroz'),
('1824a802-2c67-44d6-89f3-8bbf6098f796'::uuid,'Óleo alimentar de girassol','Óleo de girassol para cozinhar. Escolhe entre 500 ml, 1 litro, 2 litros e 5 litros.','oleo'),
('a0f7ae50-b946-440a-8acb-a5429c71890b'::uuid,'Açúcar branco 1 kg','Açúcar branco granulado. Embalagem de 1 kg.','acucar'),
('ad9b0aa3-8a3a-46ad-9584-32f2003fe2c6'::uuid,'Café moído torrado','Café torrado e moído. Opções de 250 g e 500 g.','cafe')
) as v(id,title,description,photo)
where p.id=v.id and p.store_id in (select id from public.kg_stores where is_test=true);
commit;
