const cards = [
  {
    title: "Heading",
    hex: "#F5FAFF",
    usage: "Title",
    cardClassName: "bg-text-heading text-text-inverse",
    detailClassName: "text-text-inverse",
  },
  {
    title: "Text Primary",
    hex: "#E8F4FF",
    usage: "Body",
    cardClassName: "bg-text-main text-text-inverse",
    detailClassName: "text-text-inverse",
  },
  {
    title: "Text Secondary",
    hex: "#040B18",
    usage: "Captions",
    cardClassName: "bg-text-sub text-text-inverse",
    detailClassName: "text-text-inverse",
  },
  {
    title: "Border",
    hex: "#1E3550",
    usage: "Dividers · Lines",
    cardClassName: "bg-background-subtle border-2 border-border-main text-text-main",
    detailClassName: "text-text-sub",
  },
] as const;

const TextAndBorderSection = () => {
  return (
    <section className="flex w-full max-w-[1280px] flex-col gap-6" aria-label="Text and border color tokens">
      <h2 className="text-text-sub text-2xl leading-8 tracking-[-0.24px]">Text & Border</h2>

      <div className="grid w-full grid-cols-1 gap-[10px] sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article
            key={card.title}
            className={`flex min-h-[176px] flex-col justify-end gap-4 overflow-hidden px-6 py-8 md:p-10 ${card.cardClassName}`}
          >
            <h3 className="text-2xl leading-8 font-semibold tracking-[-0.24px]">{card.title}</h3>
            <div className={`flex flex-col text-xl ${card.detailClassName}`}>
              <p className="font-mono leading-[1.48] tracking-[0.4px]">{card.hex}</p>
              <p className="leading-8 tracking-[-0.2px]">{card.usage}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default TextAndBorderSection;
