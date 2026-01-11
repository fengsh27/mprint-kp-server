import argparse
import csv
from collections import Counter

from wordcloud import WordCloud


STOP_WORDS = {
    "Humans",
    "Female",
    "Male",
    "Adult",
    "Middle Aged",
    "Young Adult",
    "Aged",
    "Animals",
    "Surveys and Questionnaires",
}


def parse_mesh_terms(csv_path: str, exclude_keywords: list[str]) -> Counter:
    counts: Counter = Counter()
    exclude_lower = [word.lower() for word in exclude_keywords if word]
    with open(csv_path, newline="", encoding="utf-8") as infile:
        reader = csv.DictReader(infile)
        for row in reader:
            for column in ("MeSH terms (Descriptor)", "MeSH terms (Qualifier)"):
                cell = row.get(column) or ""
                for term in (part.strip() for part in cell.split("|||")):
                    if not term or term in STOP_WORDS:
                        continue
                    if exclude_lower and any(word in term.lower() for word in exclude_lower):
                        continue
                    counts[term] += 1
    return counts


def generate_word_cloud(csv_path: str, output_path: str, exclude_keywords: list[str]) -> None:
    counts = parse_mesh_terms(csv_path, exclude_keywords)
    if not counts:
        with open(output_path, "w", encoding="utf-8") as outfile:
            outfile.write("")
        return

    wc = WordCloud(
        width=2000,
        height=2000,
        background_color="white",
        collocations=False,
    ).generate_from_frequencies(dict(counts))

    svg_data = wc.to_svg()
    with open(output_path, "w", encoding="utf-8") as outfile:
        outfile.write(svg_data)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate MeSH word cloud SVG from CSV.")
    parser.add_argument("--csv", required=True, help="Input CSV file path.")
    parser.add_argument("--output", required=True, help="Output SVG file path.")
    parser.add_argument(
        "--search_words",
        default="",
        help="Comma-separated search words to exclude.",
    )
    args = parser.parse_args()

    exclude_keywords = [word.strip() for word in args.search_words.split(",") if word.strip()]
    generate_word_cloud(args.csv, args.output, exclude_keywords)


if __name__ == "__main__":
    main()
