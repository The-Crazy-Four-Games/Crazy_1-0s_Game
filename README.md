# Project Name

Developer Names:Ruida Chen, Ammar Sharbat, Alvin Qian, Jiaming Li

Date of project start: 9/16/2025

This project (Crazy 1-0s) is a variant of the classic card game Crazy 8s that teaches players how to count in Dozenal (Base-12).

Crazy 1-0s also teaches players to do addition, subtraction, multiplication and division in Base-12 and Base-10, and hopefully other number bases in the future.

Current version only supports 1v1 play.

How to play:
Players take turns dropping cards in discard pile that match either the rank, the suit, or add the previous card to "10" in the number base of play (e.g. Base-12).
The "10" cards are special wild cards that allow the player to change the suit of play.
Face cards like "J" / "Q" / "K" and "C" in Dozenal Deck trigger an arithmetic operation minigame (called "math races").
The [10/2] card ("5" in Base-10, or "6" in Base-12) allow players to skip opponents' turn.
The goal for each round is to be the first player to get rid of all your cards.
The goal for a 1v1 match is to be the first player to get to "100" points.

The folders and files for this project are as follows:

docs - Documentation for the project

refs - Reference material used for the project, including papers

Brief Introduction to the Dozenal Counting System (presents a case for why Dozenal is a better counting system than Decimal):
https://dozenal.org/drupal/content/brief-introduction-dozenal-counting.html

Fundamental Operations In The Duodecimal System - Jay Schiffman (Covers Addition, Subtraction, Multiplication, Division):
https://dozenal.org/drupal/sites_bck/default/files/db31315_0.pdf

src - Source code
POC Demo code: https://github.com/The-Crazy-Four-Games/Crazy_1-0s_Game/commits/pocdemo/src
Rev0 code: https://github.com/The-Crazy-Four-Games/Crazy_1-0s_Game/tree/39dea941cb4f09fdf4bae406bef423574e82b811
Rev1 (final code and docs): current repo. rev1 branch: https://github.com/The-Crazy-Four-Games/Crazy_1-0s_Game/tree/rev1/src
