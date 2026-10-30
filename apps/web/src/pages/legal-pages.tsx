/** /privacy, /terms and /credits in Vietnamese and English. `{app}` is the brand name. */
import type { ReactNode } from 'react';
import { APP_HOST } from '../brand';
import { type Locale, format, useI18n } from '../i18n/i18n';

interface Section {
  heading: string;
  paragraphs: string[];
}

interface LegalDoc {
  title: string;
  intro: string;
  sections: Section[];
}

export type LegalPageKind = 'privacy' | 'terms' | 'credits';

/** The licence line of every AI-made picture, motion clip, voice and piece of music in the stories. */
export const AI_CONTENT_LICENCE = 'AI-generated for the hoandat ecosystem; owned by hoandat, all rights reserved (not CC0)';
const AI_MODELS =
  'Qwen-Image-2512, FLUX.2 klein 4B, Wan 2.2 (with lightx2v), SeedVR2, FILM, VieNeu-TTS v3 Turbo (Apache-2.0); ACE-Step 1.5 (MIT)';

const DOCS: Record<LegalPageKind, Record<Locale, LegalDoc>> = {
  privacy: {
    vi: {
      title: 'Quyền riêng tư',
      intro: `{app} (${APP_HOST}) là app kể chuyện cho trẻ em do một nhà phát triển độc lập vận hành. Trang này nói rõ app giữ gì.`,
      sections: [
        {
          heading: 'Không có tài khoản, không thu thập dữ liệu',
          paragraphs: [
            'Nghe truyện không cần đăng nhập. App không hỏi tên, tuổi hay bất kỳ thông tin nào của bé hay của phụ huynh, và không gửi gì về máy chủ ngoài việc tải trang, câu chuyện, tranh và âm thanh.',
            'Lựa chọn ngôn ngữ được lưu trong cookie hd_lang trên tên miền hoandat.com, để các app hoandat.com khác mở cùng ngôn ngữ. Cookie này chỉ chứa mã ngôn ngữ.',
            'App không có quảng cáo, không dùng cookie theo dõi và không bán dữ liệu.',
          ],
        },
        { heading: 'Liên hệ', paragraphs: ['Có câu hỏi: nhắn Trang Facebook Hoandat Apps.'] },
      ],
    },
    en: {
      title: 'Privacy',
      intro: `{app} (${APP_HOST}) is a storytelling app for children run by an independent developer. This page says what the app keeps.`,
      sections: [
        {
          heading: 'No account, no data collected',
          paragraphs: [
            'Listening needs no sign-in. The app asks for no name, age or other detail of a child or parent, and sends nothing to the server beyond loading the page, the story, its pictures and its sound.',
            'Your language choice is kept in the hd_lang cookie on the hoandat.com domain, so the other hoandat.com apps open in the same language. The cookie holds only the language code.',
            'The app shows no ads, uses no tracking cookies and sells no data.',
          ],
        },
        { heading: 'Contact', paragraphs: ['Questions: message the Hoandat Apps Facebook page.'] },
      ],
    },
  },
  terms: {
    vi: {
      title: 'Điều khoản',
      intro: '{app} miễn phí, dùng để nghe và xem truyện cổ tích Việt Nam.',
      sections: [
        {
          heading: 'Nội dung',
          paragraphs: [
            'Các truyện là truyện dân gian Việt Nam thuộc phạm vi công cộng, được kể lại bằng lời mới. Lời kể, tranh, cảnh động, giọng kể và nhạc của app thuộc về hoandat; bạn xem và chia sẻ đường link thoải mái, nhưng không được sao chép lại để bán hay đăng như của mình.',
            'Mã nguồn của app mở theo giấy phép MIT; giấy phép đó không áp dụng cho nội dung truyện.',
          ],
        },
        { heading: 'Không bảo đảm', paragraphs: ['App được cung cấp như hiện có. Có thể có lúc trang không truy cập được hoặc câu chuyện được sửa lời.'] },
      ],
    },
    en: {
      title: 'Terms',
      intro: '{app} is free, for listening to and watching Vietnamese folk tales.',
      sections: [
        {
          heading: 'Content',
          paragraphs: [
            'The stories are public-domain Vietnamese folk tales retold in new words. The words, pictures, motion, voices and music of the app belong to hoandat; watch them and share links freely, but do not copy them to sell or to publish as your own.',
            'The app source code is MIT-licensed; that licence does not cover the story content.',
          ],
        },
        { heading: 'No warranty', paragraphs: ['The app is provided as is. The site may sometimes be unavailable, and stories may be reworded.'] },
      ],
    },
  },
  credits: {
    vi: {
      title: 'Ghi công',
      intro: 'Nguồn gốc và giấy phép của nội dung trong app. Bản đầy đủ: CREDITS.md trong mã nguồn.',
      sections: [
        {
          heading: 'Các câu chuyện',
          paragraphs: ['Truyện dân gian Việt Nam, thuộc phạm vi công cộng. Lời kể viết mới cho trẻ nhỏ, không chép câu chữ của sách hay bản kể nào.'],
        },
        {
          heading: 'Tranh, cảnh động, giọng kể, nhạc',
          paragraphs: [
            `Sinh bằng AI trên máy riêng, chỉ dùng model cho phép thương mại (${AI_MODELS}); giọng kể là giọng có sẵn của VieNeu-TTS, không nhân bản giọng người thật. ${AI_CONTENT_LICENCE}.`,
            'Truyện nào chưa có tranh, giọng kể và nhạc thì hiện nền trơn và phụ đề, không dùng hình hay âm thanh thay thế.',
          ],
        },
        { heading: 'Biểu tượng và chữ', paragraphs: ['Biểu tượng app là hình vẽ vector tạm (quyển sách mở dưới vầng trăng). Chữ Inter: SIL Open Font License 1.1.'] },
      ],
    },
    en: {
      title: 'Credits',
      intro: 'Where the content of the app comes from and its licences. Full list: CREDITS.md in the source code.',
      sections: [
        {
          heading: 'Stories',
          paragraphs: ['Vietnamese folk tales in the public domain. The words are newly written for young children, not copied from any book or retelling.'],
        },
        {
          heading: 'Pictures, motion, voices, music',
          paragraphs: [
            `Generated with AI on a private machine, only with models that allow commercial use (${AI_MODELS}); the voices are VieNeu-TTS preset voices, no real person's voice is cloned. ${AI_CONTENT_LICENCE}.`,
            'A story without pictures, voice and music yet shows a plain backdrop and the subtitles; nothing stands in for them.',
          ],
        },
        { heading: 'Icon and type', paragraphs: ['The app icon is an interim vector drawing (an open book under a crescent moon). Inter typeface: SIL Open Font License 1.1.'] },
      ],
    },
  },
};

export function legalTitle(kind: LegalPageKind, locale: Locale): string {
  return DOCS[kind][locale].title;
}

export function LegalPage({ kind }: { kind: LegalPageKind }): ReactNode {
  const { locale } = useI18n();
  const doc = DOCS[kind][locale];
  return (
    <article className="card doc" data-id={`legal-${kind}`}>
      <h1 className="doc-title">{doc.title}</h1>
      <p>{format(doc.intro)}</p>
      {doc.sections.map((section) => (
        <section key={section.heading}>
          <h2 className="doc-heading">{section.heading}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </section>
      ))}
    </article>
  );
}
