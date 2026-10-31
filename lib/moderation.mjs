// 打たれた文字を Clef-flash に判定させる質問としきい値。
// ローカルの server.mjs（REST）と Pages Functions（AI バインディング）で共通に使う。

export const model = '@cf/cloudflare/clef-flash';

// 「殺陣」「死にますと云う」が abusive で 0.6 前後になるので、そこだけ 0.7 にする。
export const thresholds = {lewd: .5, disguised: .5, abusive: .7};

export function request(text) {
  return {
    model: 'clef-flash',
    state: {text},
    questions: {
      // "obscene" だと「バカ」「ゴミ」まで拾うので、性的なものに限って聞く。
      lewd: {type: 'noul', instructions: 'Is `text` sexual? Does it refer to sex, genitals, breasts, masturbation, or erotic content, including words like エロ or えろい, slang, euphemisms, and spellings split or disguised with spaces, kana, kanji, romaji, or symbols such as ○ or π? Plain insults that are not sexual do not count.'},
      // 一つの質問だと崩した表記の確率が低く出るので、別に聞いて高いほうを使う。
      disguised: {type: 'noul', instructions: 'Does `text` contain an obscene word, such as a word for genitals or sex, written with spaces, ○, ×, *, or other symbols inserted between or replacing some of its letters?'},
      // 当て字（氏ね・4ね）は字面では拾えず、読みで判断させると拾える。
      abusive: {type: 'noul', instructions: 'Japanese internet users often disguise abusive words by writing them with different characters that have the same pronunciation (for example 氏ね, 4ね, and 市ね are all read しね and mean 死ね). Read `text` by its pronunciation. Does it, read aloud, tell someone to die or threaten to kill or hurt someone?'},
    },
  };
}

export function judge(answers) {
  const probability = answer => typeof answer === 'number' ? answer : answer?.noul ?? 0;
  const scores = Object.fromEntries(Object.keys(thresholds).map(id => [id, probability(answers?.[id])]));
  return {scores, flagged: Object.entries(thresholds).some(([id, threshold]) => scores[id] >= threshold)};
}

// 判定に送る文字数の上限。展示で打たれるのは短い文なので、これを超えた分は見ない。
export const maxLength = 500;
