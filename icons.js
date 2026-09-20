// ===== メジャーデビューだ！タケルくん 画像アセット =====
// ユーザー提供のNanoBanana生成イラストから構築(圧縮・リサイズ済み)
window.HOME_BG = 'img/home_bg.jpg';
window.JOB_BG = {
  'conveni': 'img/job_bg_conveni.jpg',
  'izakaya': 'img/job_bg_izakaya.jpg',
  'event': 'img/job_bg_event.jpg',
  'hikkoshi': 'img/job_bg_hikkoshi.jpg',
  'haitatsu': 'img/job_bg_haitatsu.jpg',
  'koujou': 'img/job_bg_koujou.jpg'
};
window.JOB_THUMB = {
  'conveni': 'img/job_thumb_conveni.png',
  'izakaya': 'img/job_thumb_izakaya.png',
  'event': 'img/job_thumb_event.png',
  'hikkoshi': 'img/job_thumb_hikkoshi.png',
  'haitatsu': 'img/job_thumb_haitatsu.png',
  'koujou': 'img/job_thumb_koujou.png'
};
window.STUDIO_BG = {
  'a': 'img/studio_bg_a.jpg',
  'b': 'img/studio_bg_b.jpg',
  'c': 'img/studio_bg_c.jpg'
};
window.VENUE_BG = {
  'small': 'img/venue_bg_small.jpg',
  'mid': 'img/venue_bg_mid.jpg',
  'zepp': 'img/venue_bg_zepp.jpg',
  'hall': 'img/venue_bg_hall.jpg',
  'budokan': 'img/venue_bg_budokan.jpg'
};
window.PRACTICE_BG = {
  'small': 'img/practice_bg_small.jpg',
  'live': 'img/practice_bg_live.jpg',
  'camp': 'img/practice_bg_camp.jpg'
};
window.GOODS_THUMB = {
  'keyholder': 'img/goods_thumb_keyholder.png',
  'sticker': 'img/goods_thumb_sticker.png',
  'towel': 'img/goods_thumb_towel.png',
  'hoodie': 'img/goods_thumb_hoodie.png',
  'tshirt_long': 'img/goods_thumb_tshirt_long.png',
  'tshirt_short': 'img/goods_thumb_tshirt_short.png'
};
window.RECORDING_CHARS = {
  'guitar_idle': 'img/recording_chars_guitar_idle.png',
  'guitar_smile': 'img/recording_chars_guitar_smile.png',
  'vocal1': 'img/recording_chars_vocal1.png',
  'vocal2': 'img/recording_chars_vocal2.png',
  'bass': 'img/recording_chars_bass.png',
  'bass_smile': 'img/recording_chars_bass_smile.png',
  'drum': 'img/recording_chars_drum.png',
  'drum_smile': 'img/recording_chars_drum_smile.png',
  'keyboard': 'img/recording_chars_keyboard.png',
  'keyboard_smile': 'img/recording_chars_keyboard_smile.png',
  'producer': 'img/recording_chars_producer.png'
};
window.MANAGER_IMG = 'img/manager.png';
// ===== 選択肢つき小イベントの一枚絵 =====
// キーごとに 'data:image/png;base64,...' を入れると、そのイベントの背景として使われる。
// 未設定のキーは ui.js の CHOICE_EVENT_FALLBACK_BG にある既存の背景が代わりに使われるので、
// 画像は用意できたものから1つずつ足していけばよい。
//   street   路上ライブ(駅前で弾いていて人だかり)
//   gear     楽器が壊れた(切れた弦・不調なアンプ)
//   sns      SNSがバズる(伸びている投稿の画面)
//   magazine 雑誌の取材(インディーズ誌の記者)
//   parent   親から電話(実家からの着信)
//   onair    CDが有線で流れる(店内でふと聞こえてくる)
//   labelreq レーベルからの要求(打ち合わせ)
window.EVENT_IMG = {
  street: 'img/event_img_street.jpg',
  gear: 'img/event_img_gear.jpg',
  sns: 'img/event_img_sns.jpg',
  magazine: 'img/event_img_magazine.jpg',
  parent: 'img/event_img_parent.jpg',
  onair: 'img/event_img_onair.jpg',
  labelreq: 'img/event_img_labelreq.jpg',
};

// ===== インディーズレーベル(ロケットミュージックエンターテイメント 堀 良音) =====
window.HORI_IMG = 'img/hori.png';
window.LABEL_STAFF_IMG = 'img/label_staff.png';
window.HOME_CHAR_STATES = {
  'hungover': 'img/home_char_states_hungover.png',
  'normal': 'img/home_char_states_normal.png',
  'cold': 'img/home_char_states_cold.png',
  'fever': 'img/home_char_states_fever.png',
  'dejected': 'img/home_char_states_dejected.png'
};
window.FRIEND_OFFER_IMG = 'img/friend_offer.png';
window.REST_CUTIN_IMG = 'img/rest_cutin.png';
window.NAV_ICONS = {
  'btn_friend': 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCI+PHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiByeD0iMTIiIGZpbGw9IiNmZmZmZmYyMiIvPjx0ZXh0IHg9IjMwIiB5PSIzOCIgZm9udC1zaXplPSIyOCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+8J+RpTwvdGV4dD48L3N2Zz4=',
  'btn_home': 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCI+PHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiByeD0iMTIiIGZpbGw9IiNmZmZmZmYyMiIvPjx0ZXh0IHg9IjMwIiB5PSIzOCIgZm9udC1zaXplPSIyOCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+8J+PoDwvdGV4dD48L3N2Zz4=',
  'btn_job': 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCI+PHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiByeD0iMTIiIGZpbGw9IiNmZmZmZmYyMiIvPjx0ZXh0IHg9IjMwIiB5PSIzOCIgZm9udC1zaXplPSIyOCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+8J+SvDwvdGV4dD48L3N2Zz4=',
  'btn_practice': 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCI+PHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiByeD0iMTIiIGZpbGw9IiNmZmZmZmYyMiIvPjx0ZXh0IHg9IjMwIiB5PSIzOCIgZm9udC1zaXplPSIyOCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+8J+OtTwvdGV4dD48L3N2Zz4=',
  'btn_song': 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCI+PHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiByeD0iMTIiIGZpbGw9IiNmZmZmZmYyMiIvPjx0ZXh0IHg9IjMwIiB5PSIzOCIgZm9udC1zaXplPSIyOCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+8J+OvDwvdGV4dD48L3N2Zz4=',
  'btn_venue': 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCI+PHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiByeD0iMTIiIGZpbGw9IiNmZmZmZmYyMiIvPjx0ZXh0IHg9IjMwIiB5PSIzOCIgZm9udC1zaXplPSIyOCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+8J+OpDwvdGV4dD48L3N2Zz4=',
  'btn_sns': 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCI+PHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiByeD0iMTIiIGZpbGw9IiNmZmZmZmYyMiIvPjx0ZXh0IHg9IjMwIiB5PSIzOCIgZm9udC1zaXplPSIyOCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+8J+TsTwvdGV4dD48L3N2Zz4=',
  'btn_ad': 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCI+PHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiByeD0iMTIiIGZpbGw9IiNmZmZmZmYyMiIvPjx0ZXh0IHg9IjMwIiB5PSIzOCIgZm9udC1zaXplPSIyOCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+8J+TojwvdGV4dD48L3N2Zz4=',
  'btn_goods': 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCI+PHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiByeD0iMTIiIGZpbGw9IiNmZmZmZmYyMiIvPjx0ZXh0IHg9IjMwIiB5PSIzOCIgZm9udC1zaXplPSIyOCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+8J+bje+4jzwvdGV4dD48L3N2Zz4=',
  'btn_ranking': 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCI+PHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiByeD0iMTIiIGZpbGw9IiNmZmZmZmYyMiIvPjx0ZXh0IHg9IjMwIiB5PSIzOCIgZm9udC1zaXplPSIyOCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+8J+PhjwvdGV4dD48L3N2Zz4=',
  'btn_character': 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCI+PHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiByeD0iMTIiIGZpbGw9IiNmZmZmZmYyMiIvPjx0ZXh0IHg9IjMwIiB5PSIzOCIgZm9udC1zaXplPSIyOCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+8J+RpDwvdGV4dD48L3N2Zz4=',
  'btn_settings': 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCI+PHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiByeD0iMTIiIGZpbGw9IiNmZmZmZmYyMiIvPjx0ZXh0IHg9IjMwIiB5PSIzOCIgZm9udC1zaXplPSIyOCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+4pqZ77iPPC90ZXh0Pjwvc3ZnPg=='
};
window.TITLE_LOGO = 'img/title_logo.png';
window.BGM = { normal:'bgm/normal.mp3', title:'bgm/title.mp3', live:'bgm/live.mp3', compose:'bgm/compose.mp3', event:'bgm/event.mp3' };
window.SFX = {};

window.TAKERU_HAPPY_IMG = 'img/takeru_happy.png';

window.DRINK_IMAGES = { d1: 'img/drink_images_d1.png', d2: 'img/drink_images_d2.png', d3: 'img/drink_images_d3.png', vomit: 'img/drink_images_vomit.png' };
window.AFTERPARTY_BG = 'img/afterparty_bg.jpg';
window.VENUE_OUTSIDE_BG = 'img/venue_outside_bg.jpg';

window.PROMO_IMAGES = { stream: 'img/promo_images_stream.jpg', flyer: 'img/promo_images_flyer.jpg', ad: 'img/promo_images_ad.jpg' };

window.MEMBER_CHARS = {
  ryohei: {
    idle: 'img/member_chars_ryohei_idle.png', convo: 'img/member_chars_convo.png',
    live: ['img/member_chars_live_1.png', 'img/member_chars.png'],
  },
  kisara: {
    idle: 'img/member_chars_kisara_idle.png', convo: 'img/member_chars_convo_2.png',
    live: ['img/member_chars_live_1_2.png', 'img/member_chars_2.png'],
  },
  itsuki: {
    idle: 'img/member_chars_itsuki_idle.png', convo: 'img/member_chars_convo_3.png',
    live: ['img/member_chars_live_1_3.png', 'img/member_chars_3.png'],
  },
};
window.CONVO_CHARS = { ryohei: window.MEMBER_CHARS.ryohei.convo };

// ===== ナサケナーイ博士イベント =====
window.DR_NASAKENAI_IMG = 'img/dr_nasakenai.png';
window.LAB_BG = 'img/lab_bg.jpg';
window.NIGHT_PARK_BG = 'img/night_park_bg.jpg';

// ===== たくま(KAME) =====
window.MEMBER_CHARS.takuma = {
  idle: 'img/takuma_idle.png',
  convo: 'img/takuma_convo.png',
  live: ['img/takuma_live_1.png', 'img/takuma.png'],
};
