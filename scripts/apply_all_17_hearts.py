import re

with open('sapecas-cassino.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Clean out any partial ones first
html = re.sub(r'<button class="fav-heart-btn[^"]*"[^>]*>❤️</button>\s*', '', html)
html = re.sub(r'data-game-id="[^"]*"\s*', '', html)

# Match every game card in the lobby
def replace_card(m):
    classes = m.group(1)
    attrs = m.group(2)
    game_id = m.group(3)
    btn = '<button class="fav-heart-btn ${favoriteGameIds.includes(\'' + game_id + '\') ? \'is-fav\' : \'\'}" onclick="toggleFavoriteGame(\'' + game_id + '\', event)" title="Favoritar jogo">❤️</button>'
    return f'<div class="game-card{classes}"{attrs} data-game-id="{game_id}" onclick="navigate(\'{game_id}\')">\n            {btn}'

pattern = r'<div class="game-card([^"]*)"([^>]*)onclick="navigate\(\'([^\']+)\'\)">'
new_html = re.sub(pattern, replace_card, html)

with open('sapecas-cassino.html', 'w', encoding='utf-8') as f:
    f.write(new_html)
with open('public/sapecas-cassino.html', 'w', encoding='utf-8') as f:
    f.write(new_html)

matches = re.findall(r'data-game-id="([^"]+)"', new_html)
print('Total game cards with data-game-id now:', len(matches))
print('Total heart buttons now:', new_html.count('fav-heart-btn'))
print('Game IDs:', matches)
