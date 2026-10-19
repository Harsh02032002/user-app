"""
Move a screen's StyleSheet onto the design tokens in src/theme.

- fontWeight -> brand font family (custom fonts ignore fontWeight on Android)
- text styles without a weight get the regular brand font
- common hard-coded greys/blacks/whites/oranges -> theme colors

Usage: python scripts/apply-design-tokens.py <file.tsx> [<file.tsx> ...]
Only the `StyleSheet.create({...})` block (and inline color literals) are touched.
"""
import os
import re
import sys

WEIGHT = {
    "'100'": 'fonts.regular', "'200'": 'fonts.regular', "'300'": 'fonts.regular',
    "'400'": 'fonts.regular', "'normal'": 'fonts.regular',
    "'500'": 'fonts.medium',
    "'600'": 'fonts.bold', "'700'": 'fonts.bold', "'bold'": 'fonts.bold',
    "'800'": 'fonts.heavy', "'900'": 'fonts.heavy',
    '"600"': 'fonts.bold', '"700"': 'fonts.bold', '"bold"': 'fonts.bold', '"500"': 'fonts.medium',
}

COLORS = [
    (r"'#(?:1a1a1a|1A1A1A|111|111111|222|222222|333|333333|1F2937|111827|0F172A)'", 'colors.text'),
    (r"'#(?:444|555|666|666666|6B7280|4B5563|64748B|5F6368)'", 'colors.textSecondary'),
    (r"'#(?:777|888|888888|999|999999|9CA3AF|94A3B8|aaa|AAA|9AA0A6)'", 'colors.textTertiary'),
    (r"'#(?:f5f5f5|F5F5F5|f8f9fa|F8F9FA|fafafa|FAFAFA|f9f9f9|F9F9F9|F9FAFB|f3f4f6|F3F4F6|FAF8F3)'", 'colors.canvas'),
    (r"'#(?:fff|FFF|ffffff|FFFFFF)'", 'colors.surface'),
    (r"'#(?:eee|EEE|eeeeee|EEEEEE|e5e5e5|E5E5E5|E5E7EB|e5e7eb|f0f0f0|F0F0F0|e0e0e0|E0E0E0|ddd|DDD|E2E8F0|E8E5DE)'", 'colors.border'),
    (r"'#(?:FF6B00|ff6b00|FF6B35|ff6b35)'", 'colors.primary'),
    (r"'#(?:FFF5F0|FFF7ED|FFF4EC|FFF0E6|FFEDD5|FFF1E5)'", 'colors.primarySoft'),
    (r"'#(?:22C55E|16A34A|10B981|059669|4CAF50)'", 'colors.success'),
    (r"'#(?:EF4444|DC2626|E53935|F44336)'", 'colors.danger'),
]


def theme_import_path(path):
    src = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src')
    rel = os.path.relpath(os.path.join(src, 'theme'), os.path.dirname(os.path.abspath(path))).replace('\\', '/')
    return rel if rel.startswith('.') else './' + rel


def ensure_import(s, path):
    m = re.search(r"import \{([^}]*)\} from '([./]+theme)';", s)
    if m:
        names = [n.strip() for n in m.group(1).split(',') if n.strip()]
        for n in ('colors', 'fonts'):
            if n not in names:
                names.append(n)
        return s.replace(m.group(0), "import { %s } from '%s';" % (', '.join(names), m.group(2)), 1)
    lines = s.split('\n')
    last = max(i for i, l in enumerate(lines) if l.startswith('import '))
    while not lines[last].rstrip().endswith(';'):
        last += 1
    lines.insert(last + 1, "import { colors, fonts } from '%s';" % theme_import_path(path))
    return '\n'.join(lines)


def restyle_block(block):
    # weights -> families
    def weight(m):
        return 'fontFamily: %s' % WEIGHT.get(m.group(1), 'fonts.bold')
    block = re.sub(r"fontWeight:\s*('[^']*'|\"[^\"]*\")", weight, block)

    # text styles without a family get the regular brand font
    def add_family(m):
        body = m.group(2)
        # skip objects that spread a theme text style (it already sets the family)
        if 'fontSize' in body and 'fontFamily' not in body and '...type.' not in body:
            body = body.rstrip()
            sep = '' if body.endswith(',') or body.endswith('{') else ','
            body = body + sep + ' fontFamily: fonts.regular,\n  '
        return m.group(1) + body + '}'
    block = re.sub(r"(\n\s*\w+:\s*\{)([^{}]*)\}", add_family, block)
    return block


def main(paths):
    for path in paths:
        s = open(path, encoding='utf-8').read()
        nl = '\r\n' if '\r\n' in s else '\n'
        s = s.replace('\r\n', '\n')
        start = s.find('StyleSheet.create({')
        if start == -1:
            print('skip (no StyleSheet):', path)
            continue
        # find matching close of create({...})
        i = s.index('{', start)
        depth = 0
        for j in range(i, len(s)):
            if s[j] == '{':
                depth += 1
            elif s[j] == '}':
                depth -= 1
                if depth == 0:
                    end = j
                    break
        block = restyle_block(s[i:end + 1])
        s = s[:i] + block + s[end + 1:]
        # colour literals everywhere (styles and inline props)
        for pat, rep in COLORS:
            s = re.sub(pat, rep, s)
        s = ensure_import(s, path)
        if nl != '\n':
            s = s.replace('\n', nl)
        open(path, 'w', encoding='utf-8', newline='').write(s)
        print('restyled:', path)


if __name__ == '__main__':
    main(sys.argv[1:])
