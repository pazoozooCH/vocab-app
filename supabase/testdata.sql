-- Test data: 100 words across 4 decks for local development testing.
-- Load with: psql or via Supabase Studio SQL editor after running `npm run db:reset`
--
-- Prerequisites: a user must exist in auth.users and allowed_users.
-- The seed.sql handles allowed_users. For the auth user, sign in via
-- the app first (Google OAuth), then run this script.
--
-- Usage:
--   1. Sign in to the local app to create your auth user
--   2. Run: docker exec -i supabase_db_vocab-app psql -U postgres -d postgres < supabase/testdata.sql

-- Use the first non-test user found in auth.users (your Google login)
DO $$
DECLARE
  v_user_id uuid;
  v_deck_en1 uuid := gen_random_uuid();
  v_deck_en2 uuid := gen_random_uuid();
  v_deck_fr1 uuid := gen_random_uuid();
  v_deck_fr2 uuid := gen_random_uuid();
BEGIN
  SELECT id INTO v_user_id FROM auth.users
    WHERE email NOT IN ('test@test.local', 'e2e@test.local')
    LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No user found. Sign in to the local app first.';
  END IF;

  -- Create decks
  INSERT INTO public.decks (id, user_id, name, language) VALUES
    (v_deck_en1, v_user_id, 'English::Vocabulary', 'EN'),
    (v_deck_en2, v_user_id, 'English::Idioms', 'EN'),
    (v_deck_fr1, v_user_id, 'French::Vocabulaire', 'FR'),
    (v_deck_fr2, v_user_id, 'French::Expressions', 'FR')
  ON CONFLICT (id) DO NOTHING;

  -- English::Vocabulary (35 words)
  INSERT INTO public.words (user_id, word, language, translations, sentences_source, sentences_german, deck_id, status) VALUES
    (v_user_id, 'blemish', 'EN', ARRAY['der Makel'], ARRAY['1. The **blemish** on the painting was barely visible.'], ARRAY['1. Der **Makel** auf dem Gemälde war kaum sichtbar.'], v_deck_en1, 'pending'),
    (v_user_id, 'briny', 'EN', ARRAY['salzig'], ARRAY['1. The **briny** air reminded her of the coast.'], ARRAY['1. Die **salzige** Luft erinnerte sie an die Küste.'], v_deck_en1, 'pending'),
    (v_user_id, 'deluge', 'EN', ARRAY['die Sintflut'], ARRAY['1. A **deluge** of rain flooded the streets.'], ARRAY['1. Eine **Sintflut** von Regen überschwemmte die Straßen.'], v_deck_en1, 'pending'),
    (v_user_id, 'fiduciary', 'EN', ARRAY['treuhänderisch'], ARRAY['1. She has a **fiduciary** duty to her clients.'], ARRAY['1. Sie hat eine **treuhänderische** Pflicht gegenüber ihren Kunden.'], v_deck_en1, 'pending'),
    (v_user_id, 'gambit', 'EN', ARRAY['das Gambit'], ARRAY['1. His opening **gambit** surprised everyone.'], ARRAY['1. Sein Eröffnungs**gambit** überraschte alle.'], v_deck_en1, 'pending'),
    (v_user_id, 'humdrum', 'EN', ARRAY['eintönig'], ARRAY['1. She was tired of her **humdrum** routine.'], ARRAY['1. Sie war müde von ihrem **eintönigen** Alltag.'], v_deck_en1, 'exported'),
    (v_user_id, 'impervious', 'EN', ARRAY['undurchdringlich'], ARRAY['1. He seemed **impervious** to criticism.'], ARRAY['1. Er schien **undurchdringlich** für Kritik zu sein.'], v_deck_en1, 'exported'),
    (v_user_id, 'impetus', 'EN', ARRAY['der Anstoß'], ARRAY['1. The discovery gave **impetus** to the project.'], ARRAY['1. Die Entdeckung gab dem Projekt **Anstoß**.'], v_deck_en1, 'pending'),
    (v_user_id, 'mite', 'EN', ARRAY['der Winzling'], ARRAY['1. The little **mite** was barely visible.'], ARRAY['1. Der kleine **Winzling** war kaum sichtbar.'], v_deck_en1, 'pending'),
    (v_user_id, 'mote', 'EN', ARRAY['das Stäubchen'], ARRAY['1. A **mote** of dust danced in the sunlight.'], ARRAY['1. Ein **Stäubchen** tanzte im Sonnenlicht.'], v_deck_en1, 'pending'),
    (v_user_id, 'obsequious', 'EN', ARRAY['unterwürfig'], ARRAY['1. His **obsequious** manner annoyed his colleagues.'], ARRAY['1. Seine **unterwürfige** Art nervte seine Kollegen.'], v_deck_en1, 'pending'),
    (v_user_id, 'obstinate', 'EN', ARRAY['starrsinnig'], ARRAY['1. The **obstinate** child refused to eat.'], ARRAY['1. Das **starrsinnige** Kind weigerte sich zu essen.'], v_deck_en1, 'exported'),
    (v_user_id, 'pompous', 'EN', ARRAY['aufgeblasen'], ARRAY['1. The **pompous** speech bored the audience.'], ARRAY['1. Die **aufgeblasene** Rede langweilte das Publikum.'], v_deck_en1, 'pending'),
    (v_user_id, 'prostration', 'EN', ARRAY['die Erschöpfung'], ARRAY['1. After the marathon, **prostration** set in.'], ARRAY['1. Nach dem Marathon setzte **Erschöpfung** ein.'], v_deck_en1, 'pending'),
    (v_user_id, 'rout', 'EN', ARRAY['die Bande'], ARRAY['1. The army was put to **rout**.'], ARRAY['1. Die Armee wurde in die Flucht geschlagen.'], v_deck_en1, 'pending'),
    (v_user_id, 'shoehorn', 'EN', ARRAY['der Schuhlöffel'], ARRAY['1. He used a **shoehorn** to put on his shoes.'], ARRAY['1. Er benutzte einen **Schuhlöffel**, um seine Schuhe anzuziehen.'], v_deck_en1, 'pending'),
    (v_user_id, 'spud', 'EN', ARRAY['kleine Knolle'], ARRAY['1. She peeled the **spuds** for dinner.'], ARRAY['1. Sie schälte die **Knollen** für das Abendessen.'], v_deck_en1, 'exported'),
    (v_user_id, 'squeamish', 'EN', ARRAY['zimperlich'], ARRAY['1. She is too **squeamish** to watch horror films.'], ARRAY['1. Sie ist zu **zimperlich**, um Horrorfilme zu schauen.'], v_deck_en1, 'pending'),
    (v_user_id, 'tapered', 'EN', ARRAY['kegelig'], ARRAY['1. The **tapered** candle burned slowly.'], ARRAY['1. Die **kegelförmige** Kerze brannte langsam.'], v_deck_en1, 'pending'),
    (v_user_id, 'corny', 'EN', ARRAY['abgedroschen'], ARRAY['1. That joke was really **corny**.'], ARRAY['1. Der Witz war wirklich **abgedroschen**.'], v_deck_en1, 'pending'),
    (v_user_id, 'truncheon', 'EN', ARRAY['der Schlagstock'], ARRAY['1. The officer carried a **truncheon**.'], ARRAY['1. Der Beamte trug einen **Schlagstock**.'], v_deck_en1, 'pending'),
    (v_user_id, 'cilantro', 'EN', ARRAY['der Koriander'], ARRAY['1. Add fresh **cilantro** to the salsa.'], ARRAY['1. Fügen Sie frischen **Koriander** zur Salsa hinzu.'], v_deck_en1, 'pending'),
    (v_user_id, 'moot', 'EN', ARRAY['hinfällig'], ARRAY['1. The point is now **moot**.'], ARRAY['1. Der Punkt ist jetzt **hinfällig**.'], v_deck_en1, 'exported'),
    (v_user_id, 'wyvern', 'EN', ARRAY['geflügelter Drache'], ARRAY['1. The **wyvern** soared above the castle.'], ARRAY['1. Der **geflügelte Drache** schwebte über der Burg.'], v_deck_en1, 'pending'),
    (v_user_id, 'ruckus', 'EN', ARRAY['der Krawall'], ARRAY['1. The neighbours caused a **ruckus**.'], ARRAY['1. Die Nachbarn verursachten einen **Krawall**.'], v_deck_en1, 'pending'),
    (v_user_id, 'pantry', 'EN', ARRAY['die Speisekammer'], ARRAY['1. She went to the **pantry** for flour.'], ARRAY['1. Sie ging in die **Speisekammer**, um Mehl zu holen.'], v_deck_en1, 'pending'),
    (v_user_id, 'orthodontist', 'EN', ARRAY['der Kieferorthopäde'], ARRAY['1. The **orthodontist** adjusted her braces.'], ARRAY['1. Der **Kieferorthopäde** stellte ihre Zahnspange ein.'], v_deck_en1, 'pending'),
    (v_user_id, 'gulch', 'EN', ARRAY['die Schlucht'], ARRAY['1. They hiked through the narrow **gulch**.'], ARRAY['1. Sie wanderten durch die enge **Schlucht**.'], v_deck_en1, 'pending'),
    (v_user_id, 'fiefdom', 'EN', ARRAY['das Lehnsgut'], ARRAY['1. He ruled his department like a **fiefdom**.'], ARRAY['1. Er regierte seine Abteilung wie ein **Lehnsgut**.'], v_deck_en1, 'exported'),
    (v_user_id, 'goober', 'EN', ARRAY['die Erdnuss'], ARRAY['1. She snacked on **goobers** at the game.'], ARRAY['1. Sie knabberte **Erdnüsse** beim Spiel.'], v_deck_en1, 'pending'),
    (v_user_id, 'lickspittle', 'EN', ARRAY['der Speichellecker'], ARRAY['1. Nobody respected the boss''s **lickspittle**.'], ARRAY['1. Niemand respektierte den **Speichellecker** des Chefs.'], v_deck_en1, 'pending'),
    (v_user_id, 'hurly-burly', 'EN', ARRAY['der Wirrwarr'], ARRAY['1. The **hurly-burly** of the market was overwhelming.'], ARRAY['1. Der **Wirrwarr** des Marktes war überwältigend.'], v_deck_en1, 'pending'),
    (v_user_id, 'peewee', 'EN', ARRAY['der Zwerg'], ARRAY['1. The **peewee** football league starts Saturday.'], ARRAY['1. Die **Zwerg**-Fußballliga beginnt am Samstag.'], v_deck_en1, 'pending'),
    (v_user_id, 'scalawag', 'EN', ARRAY['der Tunichtgut'], ARRAY['1. That little **scalawag** stole my sandwich.'], ARRAY['1. Dieser kleine **Tunichtgut** hat mein Sandwich gestohlen.'], v_deck_en1, 'pending'),
    (v_user_id, 'septuagenarian', 'EN', ARRAY['der Siebzigjährige'], ARRAY['1. The **septuagenarian** ran a marathon.'], ARRAY['1. Der **Siebzigjährige** lief einen Marathon.'], v_deck_en1, 'pending');

  -- English::Idioms (25 words)
  INSERT INTO public.words (user_id, word, language, translations, sentences_source, sentences_german, deck_id, status) VALUES
    (v_user_id, 'to belie', 'EN', ARRAY['hinwegtäuschen'], ARRAY['1. His calm expression **belied** his inner turmoil.'], ARRAY['1. Sein ruhiger Ausdruck **täuschte** über seine innere Unruhe **hinweg**.'], v_deck_en2, 'pending'),
    (v_user_id, 'to gird', 'EN', ARRAY['einfassen'], ARRAY['1. She **girded** herself for the challenge.'], ARRAY['1. Sie **wappnete** sich für die Herausforderung.'], v_deck_en2, 'pending'),
    (v_user_id, 'to neigh', 'EN', ARRAY['wiehern'], ARRAY['1. The horse **neighed** loudly.'], ARRAY['1. Das Pferd **wieherte** laut.'], v_deck_en2, 'exported'),
    (v_user_id, 'to purloin', 'EN', ARRAY['entwenden'], ARRAY['1. Someone **purloined** the documents.'], ARRAY['1. Jemand hat die Dokumente **entwendet**.'], v_deck_en2, 'pending'),
    (v_user_id, 'to stipulate', 'EN', ARRAY['festsetzen'], ARRAY['1. The contract **stipulates** a deadline.'], ARRAY['1. Der Vertrag **setzt** eine Frist **fest**.'], v_deck_en2, 'pending'),
    (v_user_id, 'to wheeze', 'EN', ARRAY['keuchen'], ARRAY['1. He **wheezed** after climbing the stairs.'], ARRAY['1. Er **keuchte** nach dem Treppensteigen.'], v_deck_en2, 'pending'),
    (v_user_id, 'vulnerary drug', 'EN', ARRAY['das Wundheilmittel'], ARRAY['1. The herbalist prepared a **vulnerary drug**.'], ARRAY['1. Der Kräuterkundige bereitete ein **Wundheilmittel** zu.'], v_deck_en2, 'pending'),
    (v_user_id, 'wench', 'EN', ARRAY['das Frauenzimmer'], ARRAY['1. The old tale spoke of a brave **wench**.'], ARRAY['1. Die alte Geschichte sprach von einem tapferen **Frauenzimmer**.'], v_deck_en2, 'exported'),
    (v_user_id, 'shiv', 'EN', ARRAY['das Klappmesser'], ARRAY['1. He hid the **shiv** in his boot.'], ARRAY['1. Er versteckte das **Klappmesser** in seinem Stiefel.'], v_deck_en2, 'pending'),
    (v_user_id, 'eidetic memory', 'EN', ARRAY['eidetisches Gedächtnis'], ARRAY['1. She has an **eidetic memory** for faces.'], ARRAY['1. Sie hat ein **eidetisches Gedächtnis** für Gesichter.'], v_deck_en2, 'pending'),
    (v_user_id, 'twerp', 'EN', ARRAY['der Heini'], ARRAY['1. That **twerp** parked in my spot.'], ARRAY['1. Dieser **Heini** hat auf meinem Platz geparkt.'], v_deck_en2, 'pending'),
    (v_user_id, 'battery _[Law]_', 'EN', ARRAY['die Körperverletzung _[Law]_'], ARRAY['1. He was charged with **battery**.'], ARRAY['1. Er wurde wegen **Körperverletzung** angeklagt.'], v_deck_en2, 'pending'),
    (v_user_id, 'stupefying', 'EN', ARRAY['stumpfsinnig'], ARRAY['1. The lecture was absolutely **stupefying**.'], ARRAY['1. Die Vorlesung war absolut **stumpfsinnig**.'], v_deck_en2, 'pending'),
    (v_user_id, 'paleontology', 'EN', ARRAY['die Versteinerungskunde'], ARRAY['1. She studied **paleontology** at university.'], ARRAY['1. Sie studierte **Versteinerungskunde** an der Universität.'], v_deck_en2, 'exported'),
    (v_user_id, 'stat', 'EN', ARRAY['sofort'], ARRAY['1. The doctor said to operate **stat**.'], ARRAY['1. Der Arzt sagte, man solle **sofort** operieren.'], v_deck_en2, 'pending'),
    (v_user_id, 'to bamboozle', 'EN', ARRAY['hereinlegen'], ARRAY['1. Don''t let them **bamboozle** you.'], ARRAY['1. Lass dich nicht von ihnen **hereinlegen**.'], v_deck_en2, 'pending'),
    (v_user_id, 'to flabbergast', 'EN', ARRAY['verblüffen'], ARRAY['1. The news **flabbergasted** everyone.'], ARRAY['1. Die Nachricht **verblüffte** alle.'], v_deck_en2, 'pending'),
    (v_user_id, 'to hoodwink', 'EN', ARRAY['täuschen'], ARRAY['1. He tried to **hoodwink** the authorities.'], ARRAY['1. Er versuchte, die Behörden zu **täuschen**.'], v_deck_en2, 'pending'),
    (v_user_id, 'kerfuffle', 'EN', ARRAY['der Aufruhr'], ARRAY['1. There was quite a **kerfuffle** at the meeting.'], ARRAY['1. Es gab einen ziemlichen **Aufruhr** bei der Versammlung.'], v_deck_en2, 'pending'),
    (v_user_id, 'shenanigans', 'EN', ARRAY['die Machenschaften'], ARRAY['1. I won''t tolerate any **shenanigans**.'], ARRAY['1. Ich werde keine **Machenschaften** dulden.'], v_deck_en2, 'pending'),
    (v_user_id, 'brouhaha', 'EN', ARRAY['das Tamtam'], ARRAY['1. What''s all this **brouhaha** about?'], ARRAY['1. Was soll das ganze **Tamtam**?'], v_deck_en2, 'pending'),
    (v_user_id, 'to skedaddle', 'EN', ARRAY['sich davonmachen'], ARRAY['1. We better **skedaddle** before they notice.'], ARRAY['1. Wir sollten uns besser **davonmachen**, bevor sie es bemerken.'], v_deck_en2, 'exported'),
    (v_user_id, 'nincompoop', 'EN', ARRAY['der Dummkopf'], ARRAY['1. Only a **nincompoop** would fall for that.'], ARRAY['1. Nur ein **Dummkopf** würde darauf hereinfallen.'], v_deck_en2, 'pending'),
    (v_user_id, 'cattywampus', 'EN', ARRAY['schief'], ARRAY['1. The picture frame was all **cattywampus**.'], ARRAY['1. Der Bilderrahmen hing ganz **schief**.'], v_deck_en2, 'pending'),
    (v_user_id, 'discombobulate', 'EN', ARRAY['verwirren'], ARRAY['1. The instructions **discombobulated** me.'], ARRAY['1. Die Anweisungen haben mich **verwirrt**.'], v_deck_en2, 'pending');

  -- French::Vocabulaire (25 words)
  INSERT INTO public.words (user_id, word, language, translations, sentences_source, sentences_german, deck_id, status) VALUES
    (v_user_id, 'l''aiguilleur', 'FR', ARRAY['der Weichensteller'], ARRAY['1. **L''aiguilleur** contrôle les trains.'], ARRAY['1. Der **Weichensteller** kontrolliert die Züge.'], v_deck_fr1, 'pending'),
    (v_user_id, 'apprivoiser', 'FR', ARRAY['zähmen'], ARRAY['1. Il faut **apprivoiser** le renard.'], ARRAY['1. Man muss den Fuchs **zähmen**.'], v_deck_fr1, 'pending'),
    (v_user_id, 'bénir', 'FR', ARRAY['segnen'], ARRAY['1. Le prêtre va **bénir** les fidèles.'], ARRAY['1. Der Priester wird die Gläubigen **segnen**.'], v_deck_fr1, 'exported'),
    (v_user_id, 'la bosse', 'FR', ARRAY['die Beule'], ARRAY['1. Il a une **bosse** sur le front.'], ARRAY['1. Er hat eine **Beule** an der Stirn.'], v_deck_fr1, 'pending'),
    (v_user_id, 'délester', 'FR', ARRAY['Ballast abwerfen'], ARRAY['1. Il faut **délester** le ballon.'], ARRAY['1. Man muss den Ballon **Ballast abwerfen** lassen.'], v_deck_fr1, 'pending'),
    (v_user_id, 'escamoter', 'FR', ARRAY['verschwinden lassen'], ARRAY['1. Le magicien va **escamoter** la carte.'], ARRAY['1. Der Zauberer wird die Karte **verschwinden lassen**.'], v_deck_fr1, 'pending'),
    (v_user_id, 'l''écorce', 'FR', ARRAY['die Rinde'], ARRAY['1. **L''écorce** de cet arbre est rugueuse.'], ARRAY['1. Die **Rinde** dieses Baumes ist rau.'], v_deck_fr1, 'pending'),
    (v_user_id, 'éphémère', 'FR', ARRAY['vergänglich'], ARRAY['1. La beauté est **éphémère**.'], ARRAY['1. Die Schönheit ist **vergänglich**.'], v_deck_fr1, 'exported'),
    (v_user_id, 'le grelot', 'FR', ARRAY['die Schelle'], ARRAY['1. Le chat porte un **grelot** au cou.'], ARRAY['1. Die Katze trägt eine **Schelle** am Hals.'], v_deck_fr1, 'pending'),
    (v_user_id, 'la guêpe', 'FR', ARRAY['die Wespe'], ARRAY['1. Une **guêpe** m''a piqué.'], ARRAY['1. Eine **Wespe** hat mich gestochen.'], v_deck_fr1, 'pending'),
    (v_user_id, 'l''onglet', 'FR', ARRAY['der Tab'], ARRAY['1. Ouvrez un nouvel **onglet**.'], ARRAY['1. Öffnen Sie einen neuen **Tab**.'], v_deck_fr1, 'pending'),
    (v_user_id, 'la poisse', 'FR', ARRAY['das Pech'], ARRAY['1. Quelle **poisse** !'], ARRAY['1. Was für ein **Pech**!'], v_deck_fr1, 'pending'),
    (v_user_id, 'la poulie', 'FR', ARRAY['die Rolle'], ARRAY['1. Il a utilisé une **poulie** pour soulever la charge.'], ARRAY['1. Er benutzte eine **Rolle**, um die Last zu heben.'], v_deck_fr1, 'pending'),
    (v_user_id, 'remuer', 'FR', ARRAY['sich bewegen'], ARRAY['1. Ne **remue** pas !'], ARRAY['1. **Beweg** dich nicht!'], v_deck_fr1, 'exported'),
    (v_user_id, 'le réverbère', 'FR', ARRAY['die Straßenlampe'], ARRAY['1. Le **réverbère** éclaire la rue.'], ARRAY['1. Die **Straßenlampe** beleuchtet die Straße.'], v_deck_fr1, 'pending'),
    (v_user_id, 'le trèfle', 'FR', ARRAY['der Klee'], ARRAY['1. Elle a trouvé un **trèfle** à quatre feuilles.'], ARRAY['1. Sie hat ein vierblättriges **Kleeblatt** gefunden.'], v_deck_fr1, 'pending'),
    (v_user_id, 'juteux', 'FR', ARRAY['einträglich'], ARRAY['1. C''est une affaire **juteuse**.'], ARRAY['1. Das ist ein **einträgliches** Geschäft.'], v_deck_fr1, 'pending'),
    (v_user_id, 'le cerf-volant', 'FR', ARRAY['der Drachen'], ARRAY['1. Les enfants font voler un **cerf-volant**.'], ARRAY['1. Die Kinder lassen einen **Drachen** steigen.'], v_deck_fr1, 'pending'),
    (v_user_id, 'le jerrycan', 'FR', ARRAY['der Kanister'], ARRAY['1. Remplis le **jerrycan** d''essence.'], ARRAY['1. Fülle den **Kanister** mit Benzin.'], v_deck_fr1, 'pending'),
    (v_user_id, 'loupé', 'FR', ARRAY['verunglückt'], ARRAY['1. Le gâteau est complètement **loupé**.'], ARRAY['1. Der Kuchen ist komplett **verunglückt**.'], v_deck_fr1, 'pending'),
    (v_user_id, 'le pensum', 'FR', ARRAY['die Strafarbeit'], ARRAY['1. L''élève a reçu un **pensum**.'], ARRAY['1. Der Schüler erhielt eine **Strafarbeit**.'], v_deck_fr1, 'exported'),
    (v_user_id, 'le téton', 'FR', ARRAY['der Busen'], ARRAY['1. Le bébé cherche le **téton**.'], ARRAY['1. Das Baby sucht die **Brust**.'], v_deck_fr1, 'pending'),
    (v_user_id, 'un cauchemar', 'FR', ARRAY['der Albtraum'], ARRAY['1. J''ai fait un **cauchemar** terrible.'], ARRAY['1. Ich hatte einen schrecklichen **Albtraum**.'], v_deck_fr1, 'pending'),
    (v_user_id, 'la brebis', 'FR', ARRAY['das Mutterschaf'], ARRAY['1. La **brebis** nourrit son agneau.'], ARRAY['1. Das **Mutterschaf** nährt sein Lamm.'], v_deck_fr1, 'pending'),
    (v_user_id, 'le caillou', 'FR', ARRAY['der Kieselstein'], ARRAY['1. Il a lancé un **caillou** dans l''eau.'], ARRAY['1. Er warf einen **Kieselstein** ins Wasser.'], v_deck_fr1, 'pending');

  -- French::Expressions (15 words)
  INSERT INTO public.words (user_id, word, language, translations, sentences_source, sentences_german, deck_id, status) VALUES
    (v_user_id, 'jouer un vilain tour', 'FR', ARRAY['einen gemeinen Streich spielen'], ARRAY['1. Il m''a **joué un vilain tour**.'], ARRAY['1. Er hat mir **einen gemeinen Streich gespielt**.'], v_deck_fr2, 'pending'),
    (v_user_id, 'avoir le cafard', 'FR', ARRAY['deprimiert sein'], ARRAY['1. Aujourd''hui j''**ai le cafard**.'], ARRAY['1. Heute bin ich **deprimiert**.'], v_deck_fr2, 'pending'),
    (v_user_id, 'casser les pieds', 'FR', ARRAY['auf die Nerven gehen'], ARRAY['1. Arrête de me **casser les pieds** !'], ARRAY['1. Hör auf, mir **auf die Nerven zu gehen**!'], v_deck_fr2, 'exported'),
    (v_user_id, 'poser un lapin', 'FR', ARRAY['jemanden versetzen'], ARRAY['1. Elle m''a **posé un lapin**.'], ARRAY['1. Sie hat mich **versetzt**.'], v_deck_fr2, 'pending'),
    (v_user_id, 'tomber dans les pommes', 'FR', ARRAY['in Ohnmacht fallen'], ARRAY['1. Il est **tombé dans les pommes**.'], ARRAY['1. Er ist **in Ohnmacht gefallen**.'], v_deck_fr2, 'pending'),
    (v_user_id, 'mettre les voiles', 'FR', ARRAY['sich davonmachen'], ARRAY['1. Il a **mis les voiles** sans rien dire.'], ARRAY['1. Er hat **sich davongemacht**, ohne etwas zu sagen.'], v_deck_fr2, 'pending'),
    (v_user_id, 'avoir la pêche', 'FR', ARRAY['gut drauf sein'], ARRAY['1. Ce matin j''**ai la pêche** !'], ARRAY['1. Heute Morgen bin ich **gut drauf**!'], v_deck_fr2, 'pending'),
    (v_user_id, 'faire la grasse matinée', 'FR', ARRAY['ausschlafen'], ARRAY['1. Dimanche on va **faire la grasse matinée**.'], ARRAY['1. Am Sonntag werden wir **ausschlafen**.'], v_deck_fr2, 'exported'),
    (v_user_id, 'en avoir ras le bol', 'FR', ARRAY['die Nase voll haben'], ARRAY['1. J''**en ai ras le bol** de ce bruit.'], ARRAY['1. Ich **habe die Nase voll** von diesem Lärm.'], v_deck_fr2, 'pending'),
    (v_user_id, 'donner sa langue au chat', 'FR', ARRAY['aufgeben (beim Raten)'], ARRAY['1. Je **donne ma langue au chat**, dis-moi !'], ARRAY['1. Ich **gebe auf**, sag es mir!'], v_deck_fr2, 'pending'),
    (v_user_id, 'couper la poire en deux', 'FR', ARRAY['einen Kompromiss finden'], ARRAY['1. On va **couper la poire en deux**.'], ARRAY['1. Wir werden **einen Kompromiss finden**.'], v_deck_fr2, 'pending'),
    (v_user_id, 'faire chou blanc', 'FR', ARRAY['eine Niete ziehen'], ARRAY['1. Nous avons **fait chou blanc** à la pêche.'], ARRAY['1. Wir haben beim Angeln **eine Niete gezogen**.'], v_deck_fr2, 'pending'),
    (v_user_id, 'se mettre le doigt dans l''œil', 'FR', ARRAY['sich gewaltig irren'], ARRAY['1. Tu **te mets le doigt dans l''œil** si tu crois ça.'], ARRAY['1. Du **irrst dich gewaltig**, wenn du das glaubst.'], v_deck_fr2, 'pending'),
    (v_user_id, 'avoir un chat dans la gorge', 'FR', ARRAY['einen Frosch im Hals haben'], ARRAY['1. Excusez-moi, j''**ai un chat dans la gorge**.'], ARRAY['1. Entschuldigung, ich **habe einen Frosch im Hals**.'], v_deck_fr2, 'pending'),
    (v_user_id, 'il pleut des cordes', 'FR', ARRAY['es regnet in Strömen'], ARRAY['1. Reste à la maison, **il pleut des cordes**.'], ARRAY['1. Bleib zu Hause, **es regnet in Strömen**.'], v_deck_fr2, 'pending');

  RAISE NOTICE 'Test data loaded: 100 words in 4 decks for user %', v_user_id;
END $$;
