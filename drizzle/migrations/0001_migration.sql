
insert into public.club_settings(id) values (1);
insert into public.seasons(name,start_date,end_date,is_active) values
 ('2025/26','2025-09-01','2026-08-31',false), ('2026/27','2026-09-01','2027-08-31',true);

insert into public.deadline_categories(name,color,sort,description) values
 ('Fiscale/contabile','#0B2A5B',1,'F24, IVA 398, rendiconto, ritenute'),
 ('Lavoro sportivo','#1E4D8C',2,'Compensi, comunicazioni RASD, LUL'),
 ('FIP/Lega','#C8102E',3,'Iscrizione campionato, tasse gara, tesseramenti, nulla osta'),
 ('Sponsor','#E0A100',4,'Rate, rinnovi, controprestazioni'),
 ('Impianto PalaTerme','#3B7A57',5,'Convenzione, agibilità, SCIA, antincendio'),
 ('Sanità e sicurezza','#B23A48',6,'Certificati, DAE, BLSD'),
 ('Assicurazioni','#5C6B7A',7,'Polizze, denunce infortuni'),
 ('Contratti','#6A4C93',8,'Fornitori, giocatori, utenze, trasferte'),
 ('Societarie','#2F3E46',9,'Assemblea, rendiconto, RASD, safeguarding'),
 ('Personalizzate','#888888',10,'Libere');

insert into public.sponsor_levels(name,list_price,sort) values
 ('Main/Naming',300000,1),('Gold',60000,2),('Silver',25000,3),('Bronze',10000,4),
 ('Fornitore ufficiale',8000,5),('Partner tecnico',15000,6),('Media partner',5000,7),
 ('Sponsor settore giovanile',3000,8),('Amici della Gema',1000,9);

insert into public.sectors(name,capacity,sort,kind) values
 ('Parterre',250,1,'pubblico'),('Tribuna centrale',900,2,'pubblico'),('Tribune laterali',1200,3,'pubblico'),
 ('Curva',600,4,'pubblico'),('Settore ospiti',200,5,'ospiti'),('Disabili e accompagnatori',30,6,'disabili'),
 ('Area stampa',40,7,'stampa'),('Hospitality VIP sponsor',120,8,'hospitality');

-- listino
insert into public.price_list(season_id,sector_id,ticket_type,tier,price)
select se.id, s.id, t.tt, ti.tier,
  round(b.base * t.f * ti.m)
from public.seasons se, public.sectors s
join (values ('Parterre',35),('Tribuna centrale',22),('Tribune laterali',15),('Curva',10),('Settore ospiti',12),('Disabili e accompagnatori',0),('Area stampa',0),('Hospitality VIP sponsor',60)) b(n,base) on b.n=s.name
cross join (values ('intero',1.0),('ridotto',0.7),('ridotto_giovanili',0.5),('omaggio',0),('accredito',0)) t(tt,f)
cross join (values ('normale',1.0),('cartello',1.2),('playoff',1.4),('abbonamento',11.0)) ti(tier,m)
where se.is_active and not (ti.tier='abbonamento' and t.tt in ('omaggio','accredito'));

insert into public.checklist_templates(area,task,sort) values
 ('Ufficiali','Ufficiali di campo e statistici confermati',1),
 ('Sicurezza','Steward e security in servizio',2),
 ('Sanità','Ambulanza e medico presenti',3),
 ('Sanità','DAE verificato e operatore BLSD presente',4),
 ('Spettacolo','Speaker e musica',5),
 ('Spettacolo','LED e maxischermo con scaletta sponsor',6),
 ('Impianto','Pulizie pre e post gara',7),
 ('Hospitality','Area hospitality allestita e catering',8),
 ('Accoglienza','Accoglienza arbitri',9),
 ('Accoglienza','Accoglienza squadra ospite',10),
 ('Istituzioni','Comunicazioni Questura e Comune',11),
 ('Botteghino','Fondi cassa e POS pronti',12);

insert into public.aed_devices(location,serial,pads_expiry,battery_expiry) values
 ('PalaTerme – ingresso campo','DAE-PT-001','2027-01-10','2028-05-01'),
 ('PalaVinci','DAE-PV-002','2026-12-05','2027-03-01'),
 ('PalaPertini Ponte Buggianese','DAE-PP-003','2027-06-30','2027-11-20');

do $$
declare
  _s uuid; _prev uuid; _m uuid; i int; j int; _d date; _cid uuid; _sid uuid; _sec uuid;
  opp text[] := array['Fortitudo Bologna','RivieraBanca Rimini','Tramec Cento','Unieuro Forlì','Vuelle Pesaro','Libertas Livorno','Pielle Livorno','Ristopro Fabriano','Juvi Cremona','Orzinuovi','Assigeco Piacenza','Urania Milano','Elachem Vigevano','Bergamo Basket','Real Sebastiani Rieti'];
  fn text[] := array['Lorenzo','Matteo','Tommaso','Leonardo','Francesco','Alessandro','Gabriele','Riccardo','Edoardo','Pietro','Niccolò','Filippo','Jacopo','Diego','Samuele','Marco','Giulia','Sofia','Chiara','Elena','Martina','Andrea','Luca','Simone','Federico','Paolo','Giovanni','Stefano','Davide','Roberta'];
  ln text[] := array['Rossi','Bianchi','Bertini','Paoli','Innocenti','Lazzerini','Magnani','Niccolai','Baldi','Giusti','Frosini','Mariotti','Bartolini','Martini','Pieri','Salvadori','Tognetti','Lenzi','Benedetti','Cecchi','Galli','Nesti','Orsi','Vannucci','Fontana','Biagini','Guidi','Michelotti','Pacini','Sardi'];
  sp text[] := array['Banca della Valdinievole (demo)','Termalia Hotel & Spa','Pasticceria Montecatini Dolce','Autosalone Nievole Motors','Edil Valdinievole Costruzioni','Farmacia Centrale Montecatini','Ottica Bertini','Caseificio Colline Pistoiesi','Studio Dentistico Sorriso','Ristorante Il Tettuccio Blu','Toscana Energia Locale','Sport Line Abbigliamento','Pizzeria La Rossoblù','Supermercati Valdinievole','Assicurazioni Paoli & Figli','Radio Valdinievole Live','Tipografia Pescia Print','Gelateria Viale Verdi','Agenzia Viaggi Terme Tour','Officina Lazzerini','Vivaio Pescia Fiori','Studio Commercialisti Associati','Acque Minerali Colle Verde','Palestra Fit Terme'];
  lv text[] := array['Gold','Gold','Silver','Silver','Silver','Bronze','Bronze','Bronze','Bronze','Fornitore ufficiale','Partner tecnico','Partner tecnico','Fornitore ufficiale','Gold','Bronze','Media partner','Fornitore ufficiale','Amici della Gema','Sponsor settore giovanile','Amici della Gema','Sponsor settore giovanile','Silver','Fornitore ufficiale','Amici della Gema'];
  amt numeric; _lvl uuid; stage text; _tid uuid; _pid uuid; _by int; nrates int; teamnames text[] := array['U19 Eccellenza','U17 Gold','U15 Silver','U14 Elite']; teamcat text[] := array['U19','U17','U15','U14']; teamyears int[] := array[2008,2010,2012,2013];
begin
  select id into _s from public.seasons where is_active;
  select id into _prev from public.seasons where name='2025/26';

  -- asset
  insert into public.sponsor_assets(season_id,name,category,unit,quantity,price) values
   (_s,'Maglia – fronte (main)','Maglia','stagione',1,150000),(_s,'Maglia – retro alto','Maglia','stagione',1,40000),
   (_s,'Maglia – retro sotto numero','Maglia','stagione',1,25000),(_s,'Pantaloncini – fronte','Maglia','stagione',2,15000),
   (_s,'Maniche','Maglia','stagione',2,12000),(_s,'Naming squadra','Naming','stagione',1,150000),
   (_s,'LED bordo campo – pacchetto 60 sec/partita','LED','partita',20,6000),(_s,'Cartellone fisso PalaTerme 6x1 m','Cartellonistica','stagione',30,2500),
   (_s,'Logo sul parquet','Parquet','stagione',4,20000),(_s,'Backdrop interviste','Backdrop','stagione',8,3000),
   (_s,'Spot maxischermo','Maxischermo','stagione',10,2000),(_s,'Post social + story (pacchetto 10)','Social','stagione',20,1500),
   (_s,'Newsletter e sito – banner','Digital','stagione',10,1000),(_s,'Annuncio speaker','Speaker','stagione',15,800),
   (_s,'Naming settore Tribuna centrale','Naming','stagione',1,20000),(_s,'Pass hospitality stagionali (10 pax)','Hospitality','stagione',10,5000),
   (_s,'Evento aziendale con i giocatori','Eventi','stagione',6,3500);

  -- La T Tecnica main sponsor
  insert into public.sponsors(name,level_id,contact_name,email,phone,website,pipeline_stage,notes)
  values ('La T Tecnica S.p.A.',(select id from public.sponsor_levels where name='Main/Naming'),'Ufficio Marketing','marketing@latecnica.example','0572 000000','https://www.latecnica.it','firmato','Main sponsor e naming sponsor')
  returning id into _sid;
  insert into public.sponsor_contracts(sponsor_id,season_id,title,amount_cash,start_date,end_date,auto_renew,status,signed_at,tickets_per_match,hospitality_per_match,led_seconds_per_match,posts_per_season)
  values (_sid,_s,'Naming + Main sponsor 2026/27',280000,'2026-09-01','2027-06-30',true,'attivo','2026-07-15',20,12,180,40) returning id into _cid;
  insert into public.contract_assets(contract_id,asset_id) select _cid,id from public.sponsor_assets where name in ('Maglia – fronte (main)','Naming squadra','Logo sul parquet');
  insert into public.sponsor_installments(contract_id,due_date,amount,invoice_number,invoiced_at,paid_at) values
   (_cid,'2026-09-30',70000,'S-2026-001','2026-09-20','2026-10-10'),
   (_cid,'2026-12-31',70000,null,null,null),(_cid,'2027-03-31',70000,null,null,null),(_cid,'2027-06-30',70000,null,null,null);

  for i in 1..24 loop
    select id, list_price into _lvl, amt from public.sponsor_levels where name=lv[i];
    stage := case when i in (21,22) then 'trattativa' when i=23 then 'proposta' when i=24 then 'contatto' else 'firmato' end;
    insert into public.sponsors(name,level_id,contact_name,email,phone,pipeline_stage,expected_value)
    values (sp[i],_lvl, fn[1+(i%30)]||' '||ln[1+((i*7)%30)], 'info'||i||'@sponsor-demo.it','0572 '||(100000+i*137), stage, amt)
    returning id into _sid;
    insert into public.crm_activities(sponsor_id,type,activity_date,notes,reminder_date,done) values
     (_sid,'incontro', date '2026-06-01' + i*3, 'Presentazione pacchetti stagione 2026/27', null, true),
     (_sid,'chiamata', current_date + (i%12) - 3, 'Follow-up e verifica soddisfazione', current_date + (i%12), false);
    if stage='firmato' then
      amt := round(amt * (0.8 + (i%5)*0.1));
      insert into public.sponsor_contracts(sponsor_id,season_id,title,amount_cash,amount_goods,is_barter,start_date,end_date,status,signed_at,tickets_per_match,hospitality_per_match,led_seconds_per_match,posts_per_season,auto_renew)
      values (_sid,_s,lv[i]||' 2026/27', case when lv[i]='Fornitore ufficiale' then round(amt*0.4) else amt end,
        case when lv[i]='Fornitore ufficiale' then round(amt*0.6) else 0 end, lv[i]='Fornitore ufficiale',
        '2026-09-01', case when i%4=0 then current_date + 45 + i else '2027-06-30'::date end, 'attivo', '2026-08-01',
        case when lv[i]='Gold' then 6 when lv[i]='Silver' then 4 else 2 end,
        case when lv[i]='Gold' then 4 when lv[i]='Silver' then 2 else 0 end,
        case when lv[i] in ('Gold','Silver') then 60 when lv[i]='Bronze' then 30 else 0 end,
        case when lv[i] in ('Gold','Silver') then 10 else 4 end, i%3=0)
      returning id into _cid;
      nrates := case when amt > 20000 then 3 else 2 end;
      for j in 1..nrates loop
        _d := case j when 1 then date '2026-10-15' when 2 then date '2027-01-15' else date '2027-04-15' end;
        if j=1 and i%5=0 then _d := current_date - 20; end if;
        insert into public.sponsor_installments(contract_id,due_date,amount,invoice_number,invoiced_at,paid_at)
        values (_cid,_d, round((case when lv[i]='Fornitore ufficiale' then amt*0.4 else amt end)/nrates,2),
          case when _d < current_date then 'S-2026-'||lpad((i*3+j)::text,3,'0') end,
          case when _d < current_date then _d - 10 end,
          case when _d < current_date and i%5<>0 then _d + 5 end);
      end loop;
      insert into public.contract_assets(contract_id,asset_id)
        select _cid, id from public.sponsor_assets where name = case
          when lv[i]='Gold' and i=1 then 'Maglia – retro alto' when lv[i]='Gold' and i=2 then 'Maglia – retro sotto numero'
          when lv[i]='Gold' then 'Naming settore Tribuna centrale'
          when lv[i]='Silver' then 'LED bordo campo – pacchetto 60 sec/partita'
          when lv[i]='Partner tecnico' then 'Maniche'
          else 'Cartellone fisso PalaTerme 6x1 m' end;
    end if;
  end loop;

  -- partite
  for i in 0..14 loop
    insert into public.matches(season_id,round,opponent,match_date,gates_open,tier,tv,referees,commissioner,presale_url,aed_checked,blsd_operator,status)
    values (_s, i*2+1, opp[i+1], ((date '2026-10-04' + i*14) + time '18:00') at time zone 'Europe/Rome', '17:00',
      case when opp[i+1] in ('Fortitudo Bologna','Vuelle Pesaro','Pielle Livorno') then 'cartello' else 'normale' end,
      'LNP TV Pass', case when i<4 then 'Rossi – Bianchi – Verdi' end, case when i<4 then 'Dott. Neri' end,
      'https://www.ticketone.it', i<4, case when i<4 then 'Marco Lenzi (BLSD 2027)' end,
      case when i<4 then 'chiusa' else 'programmata' end)
    returning id into _m;
    if i<4 then
      update public.matches set home_score = 78 + i*3, away_score = 72 + (i%3)*4 where id=_m;
      update public.match_checklist set done=true, assignee='Segreteria' where match_id=_m;
      -- vendite botteghino
      for j in 1..60 loop
        select id into _sec from public.sectors where name = (array['Tribuna centrale','Tribune laterali','Curva','Settore ospiti','Parterre'])[1+(j%5)];
        insert into public.ticket_sales(match_id,sector_id,ticket_type,qty,unit_price,total,payment_method,channel)
        select _m,_sec, tt, q, p.price, p.price*q, case when j%3=0 then 'pos' else 'contanti' end, 'botteghino'
        from (select (array['intero','intero','ridotto','ridotto_giovanili'])[1+(j%4)] tt, 1+(j%4) q) x
        join public.price_list p on p.sector_id=_sec and p.ticket_type=x.tt and p.tier='normale' and p.season_id=_s;
      end loop;
      for j in 1..25 loop
        select id into _sec from public.sectors where name = (array['Tribuna centrale','Tribune laterali','Curva'])[1+(j%3)];
        insert into public.ticket_sales(match_id,sector_id,ticket_type,qty,unit_price,total,payment_method,channel)
        select _m,_sec,'intero', 2, p.price, p.price*2, 'online','online'
        from public.price_list p where p.sector_id=_sec and p.ticket_type='intero' and p.tier='normale' and p.season_id=_s;
      end loop;
    end if;
  end loop;

  -- abbonati
  for i in 1..300 loop
    select id into _sec from public.sectors where name = case when i<=30 then 'Parterre' when i<=150 then 'Tribuna centrale' when i<=250 then 'Tribune laterali' else 'Curva' end;
    insert into public.subscribers(season_id,first_name,last_name,email,phone,sector_id,seat,sub_type,price,paid,payment_method,renewed_from_previous)
    select _s, fn[1+(i%30)], ln[1+((i*13)%30)], lower(fn[1+(i%30)])||'.'||lower(ln[1+((i*13)%30)])||i||'@email.it', '333 '||(1000000+i*791),
      _sec, case when i<=150 then 'Fila '||chr(65+(i%12))||' – '||(1+i%20) end,
      x.tt, p.price, i%17<>0, case when i%3=0 then 'bonifico' else 'contanti' end, i%4<>0
    from (select (array['intero','intero','ridotto','ridotto_giovanili'])[1+(i%4)] tt) x
    join public.price_list p on p.sector_id=_sec and p.ticket_type=x.tt and p.tier='abbonamento' and p.season_id=_s;
  end loop;
  -- storico stagione precedente (per confronto)
  insert into public.subscribers(season_id,first_name,last_name,sector_id,sub_type,price,paid)
  select _prev, first_name, last_name, sector_id, sub_type, round(price*0.93), true from public.subscribers where season_id=_s and renewed_from_previous;

  -- ingressi partite giocate
  insert into public.entries(match_id,qr_code,kind,sector_id,scanned_at)
  select m.id, b.qr_code, 'abbonato', b.sector_id, m.match_date - interval '20 minutes'
  from public.matches m cross join public.subscribers b
  where m.status='chiusa' and b.season_id=_s and b.paid and (abs(hashtext(b.qr_code||m.id::text)) % 100) < 82;

  -- accrediti partite: sponsor + stampa
  insert into public.accreditations(match_id,list_type,sponsor_id,full_name,organization,sector_id,is_hospitality)
  select m.id,'sponsor',c.sponsor_id,'Ospite '||g||' '||s.name, s.name,(select id from public.sectors where name='Hospitality VIP sponsor'),true
  from public.matches m join public.sponsor_contracts c on c.hospitality_per_match>0 join public.sponsors s on s.id=c.sponsor_id
  cross join generate_series(1,2) g where m.status='chiusa' or m.match_date < now() + interval '15 days';
  insert into public.accreditations(match_id,list_type,full_name,organization,sector_id)
  select m.id,'stampa',x.n,x.o,(select id from public.sectors where name='Area stampa')
  from public.matches m cross join (values ('Giornalista','La Nazione'),('Fotografo','Il Tirreno'),('Telecronista','LNP TV'),('Redattore','Valdinievole Oggi')) x(n,o);

  -- controprestazioni
  insert into public.sponsor_deliverables(contract_id,match_id,type,description,due_date,delivered,delivered_at,proof_url)
  select c.id, m.id, 'LED', c.led_seconds_per_match||' secondi LED', (m.match_date at time zone 'Europe/Rome')::date,
    m.status='chiusa', case when m.status='chiusa' then (m.match_date at time zone 'Europe/Rome')::date end,
    case when m.status='chiusa' then 'https://foto.gema.example/led' end
  from public.sponsor_contracts c cross join public.matches m where c.led_seconds_per_match>0;
  insert into public.sponsor_deliverables(contract_id,type,description,due_date,delivered,delivered_at,interactions)
  select c.id,'Social','Post dedicato #'||g, date '2026-09-15' + g*20, (date '2026-09-15' + g*20) < current_date,
    case when (date '2026-09-15' + g*20) < current_date then date '2026-09-15' + g*20 end, case when (date '2026-09-15' + g*20) < current_date then 300 + g*45 end
  from public.sponsor_contracts c cross join generate_series(1,4) g where c.posts_per_season>0;

  -- scadenze manuali
  insert into public.deadlines(title,category,due_date,recurrence,amount,status,notes) values
   ('F24 ritenute collaboratori','Fiscale/contabile', date '2026-11-16','mensile',4800,'da_fare','Codice tributo 1040/1001'),
   ('Versamento IVA 398 – III trimestre','Fiscale/contabile', date '2026-11-16','trimestrale',9200,'in_corso','50% IVA incassata'),
   ('Liquidazione IVA 398 – IV trimestre','Fiscale/contabile', date '2027-02-16','trimestrale',null,'da_fare',null),
   ('Comunicazioni RASD rapporti di lavoro sportivo','Lavoro sportivo', date '2026-11-30','mensile',null,'da_fare','Entro il 30 del mese successivo'),
   ('Compensi staff e giocatori – novembre','Lavoro sportivo', date '2026-12-05','mensile',62000,'da_fare',null),
   ('LUL annuale','Lavoro sportivo', date '2027-01-31','annuale',null,'da_fare',null),
   ('Saldo tassa iscrizione campionato Serie A2','FIP/Lega', date '2026-11-20',  'stagione',35000,'da_fare',null),
   ('Rinnovo tesseramenti stagione successiva','FIP/Lega', date '2027-06-30','stagione',null,'da_fare',null),
   ('Rata convenzione PalaTerme con il Comune','Impianto PalaTerme', date '2026-11-10','trimestrale',12000,'da_fare','Bonifico al Comune di Montecatini Terme'),
   ('Rinnovo agibilità pubblico spettacolo (CPVLPS)','Impianto PalaTerme', date '2026-12-15','annuale',null,'da_fare',null),
   ('Verifica estintori e antincendio PalaTerme','Impianto PalaTerme', date '2026-11-25','trimestrale',450,'da_fare',null),
   ('Piano sicurezza e gestione emergenze – aggiornamento','Impianto PalaTerme', date '2027-01-15','stagione',null,'da_fare',null),
   ('Retraining BLSD staff','Sanità e sicurezza', date '2026-12-01','annuale',600,'da_fare',null),
   ('Polizza RC società – rinnovo','Assicurazioni', date '2026-12-31','annuale',5400,'da_fare',null),
   ('Contratto pullman trasferte – rinnovo','Contratti', date '2026-11-22','stagione',null,'in_corso',null),
   ('Utenze sede – bolletta','Contratti', date '2026-11-12','mensile',380,'da_fare',null),
   ('Aggiornamento dati RASD','Societarie', date '2027-01-31','annuale',null,'da_fare','Entro il 31 gennaio'),
   ('Assemblea approvazione rendiconto','Societarie', date '2026-12-31','annuale',null,'da_fare','Entro 4 mesi dalla chiusura'),
   ('Rinnovo mandato responsabile safeguarding','Societarie', date '2028-09-01','una_volta',null,'da_fare','Mandato 4 anni'),
   ('Consegna kit gara giovanili','Personalizzate', date '2026-11-18','una_volta',null,'da_fare',null);

  -- squadre giovanili + 50 atleti
  for i in 1..4 loop
    insert into public.teams(season_id,name,category,league,birth_years)
    values (_s,'Gema '||teamnames[i],teamcat[i],'Campionato '||teamnames[i]||' – Toscana', teamyears[i]::text||case when i<3 then '-'||(teamyears[i]+1) else '' end)
    returning id into _tid;
    for j in 1..(case when i<=2 then 13 else 12 end) loop
      _by := teamyears[i] + (j%2) * case when i<3 then 1 else 0 end;
      insert into public.persons(first_name,last_name,sex,birth_date,birth_place,tax_code,email,phone,emergency_contact)
      values (fn[1+((i*13+j)%16)], ln[1+((i*7+j*3)%30)], 'M', make_date(_by, 1+(j%12), 1+(j*2%27)), 'Montecatini Terme',
        'DEMO'||lpad((i*100+j)::text,12,'0'), 'famiglia'||i||j||'@email.it','347 '||(2000000+i*1000+j), 'Genitore – 348 '||(3000000+i*1000+j))
      returning id into _pid;
      insert into public.team_members(team_id,person_id,role,jersey) values (_tid,_pid,'atleta',3+j);
      insert into public.medical_certificates(person_id,type,visit_date,expiry_date,doctor,verified)
      select _pid,'agonistico', d - 365, d, 'Centro Medicina Sport Valdinievole', true
      from (select case when j%9=0 then null when j%7=0 then current_date - 10 when j%5=0 then current_date + 20 else current_date + 120 + j*5 end d) x where d is not null;
      insert into public.fip_registrations(person_id,season_id,type,card_number,status,registered_at)
      values (_pid,_s,'atleta', case when j%8<>0 then 'FIP'||(900000+i*100+j) end, case when j%8=0 then 'in_attesa_pin' else 'attivo' end, case when j%8<>0 then date '2026-09-10' end);
    end loop;
    insert into public.events(team_id,type,title,starts_at,location)
    select _tid,'allenamento','Allenamento '||teamnames[i], ((current_date + g) + time '18:30') at time zone 'Europe/Rome', 'PalaVinci'
    from generate_series(1,14) g where extract(dow from current_date + g) in (1,3,5);
  end loop;

  insert into public.announcements(title,body,pinned) values
   ('Campagna abbonamenti 2026/27','Ultimi giorni per rinnovare con prelazione. Vieni al botteghino del PalaTerme!',true),
   ('Open day minibasket','Sabato al PalaVinci prova gratuita per i nati 2016-2020.',false);
  insert into public.inventory_items(name,category,size,stock) values
   ('Divisa gara rossoblù','Divise','M',40),('Divisa gara rossoblù','Divise','L',35),('Tuta di rappresentanza','Tute','L',30),('Pallone Molten BG4500','Palloni','7',24),('Borsa Gema','Borse','U',50);
  insert into public.assemblies(type,meeting_date,agenda,status) values ('assemblea', date '2026-12-15','Approvazione rendiconto 2025/26; varie ed eventuali','convocata');
  insert into public.enrollments(first_name,last_name,birth_date,parent_name,parent_email,requested_team) values
   ('Tommaso','Guidi','2013-04-11','Laura Guidi','laura.guidi@email.it','U14'),('Pietro','Nesti','2012-09-02','Carlo Nesti','carlo.nesti@email.it','U15');
end $$;

select public.register_bordero(id) from public.matches where status='chiusa';
