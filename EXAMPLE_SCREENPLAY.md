# Example Screenplay Format

The screenplay parser requires a specific format to detect characters and extract dialogue. This guide shows you exactly how to format your screenplay.

## Required Format

### Method 1: Character List + Multi-line Dialogue (Recommended)

```
Characters:
- JOHN
- SARAH
- DETECTIVE MILLER

INT. COFFEE SHOP - DAY

JOHN
I can't believe you're here. After all these years.

SARAH
I had to come back, John. There are things you need to know.

DETECTIVE MILLER
Mind if I join you two?

JOHN
Actually, we do mind.
```

**Key Points:**
- Start with `Characters:` on its own line
- List each character on a new line starting with `-` (dash)
- Character names should be in ALL CAPS in the character list
- After the character list, add a blank line
- Scene headings start with `INT.`, `EXT.`, or `I/E.`
- Character names appear on their own line before dialogue
- Dialogue follows on the next line(s)
- Blank lines separate different speakers

---

### Method 2: Inline Dialogue Format

```
Characters:
- ALICE
- BOB
- CHARLIE

ALICE: Hello Bob, how are you today?
BOB: I'm doing great, thanks for asking!
CHARLIE: Hey everyone, what's going on?
ALICE: We were just catching up.
```

**Key Points:**
- Still need the `Characters:` section first
- Use format: `CHARACTER NAME: dialogue text`
- Character name must be in ALL CAPS
- Colon `:` separates name from dialogue
- One line per dialogue chunk

---

### Method 3: Mixed Format

```
Characters:
- NARRATOR
- LUKE
- MARIA

NARRATOR: In a galaxy far, far away...

INT. SPACESHIP - NIGHT

LUKE
We have to turn back. The shields won't hold much longer.

MARIA: I'm not giving up now, Luke!

LUKE
Maria, please. We don't have a choice.
```

**Key Points:**
- Combine both inline and multi-line formats
- Always define characters in the `Characters:` section first
- Parser will recognize both formats

---

### Alias & Parenthetical Handling

```
Characters:
- DETECTIVE SARAH MILLER
- HACKER "ACE"

DETECTIVE MILLER: We found the drive. Start decrypting.
SARAH: Give me five minutes.
SARAH (V.O.): We might not have five minutes.
DETECTIVE MILLER: Stay focused, Sarah.
HACKER "ACE"
One firewall at a time...
```

**Key Points:**
- A single entry such as `DETECTIVE SARAH MILLER` will also match `SARAH`, `SARAH MILLER`, and `DETECTIVE MILLER`.
- Parentheticals like `(V.O.)`, `(O.S.)`, or `(CONT'D)` are ignored when matching characters.

---

## Complete Working Example

Copy and paste this into the app to test:

```
Characters:
- DETECTIVE JONES
- SUSPECT
- LAWYER

INT. INTERROGATION ROOM - NIGHT

DETECTIVE JONES
Where were you on the night of October 15th?

SUSPECT
I was home. Alone.

DETECTIVE JONES
Can anyone verify that?

SUSPECT
No. But I didn't do anything wrong.

LAWYER
My client has answered your question, Detective.

DETECTIVE JONES: Then we're done here. For now.
```

---

## Formatting Rules

### ✅ DO:

1. **Always include a Characters section**
   ```
   Characters:
   - CHARACTER ONE
   - CHARACTER TWO
   ```

2. **Use ALL CAPS for character names**
   ```
   JOHN
   Not john or John
   ```

3. **Use blank lines to separate speakers**
   ```
   ALICE
   Hello there.

   BOB
   Hi Alice!
   ```

4. **Include scene headings (optional but recommended)**
   ```
   INT. BEDROOM - MORNING
   EXT. PARK - DAY
   ```

5. **Use parentheticals for stage directions (they'll be removed from audio)**
   ```
   SARAH
   (whispering)
   Don't let them hear you.
   ```

### ❌ DON'T:

1. **Don't skip the Characters section**
   ```
   ❌ BAD:
   ALICE
   Hello Bob!

   BOB
   Hi Alice!
   ```

   ```
   ✅ GOOD:
   Characters:
   - ALICE
   - BOB

   ALICE
   Hello Bob!

   BOB
   Hi Alice!
   ```

2. **Don't use lowercase for character names**
   ```
   ❌ BAD:
   Characters:
   - alice
   - bob
   ```

   ```
   ✅ GOOD:
   Characters:
   - ALICE
   - BOB
   ```

3. **Don't forget the dash `-` in character definitions**
   ```
   ❌ BAD:
   Characters:
   ALICE
   BOB
   ```

   ```
   ✅ GOOD:
   Characters:
   - ALICE
   - BOB
   ```

4. **Don't mix character name formats**
   ```
   ❌ BAD:
   Characters:
   - ALICE SMITH

   ALICE
   Hello!
   ```

   ```
   ✅ GOOD:
   Characters:
   - ALICE SMITH

   ALICE SMITH
   Hello!
   ```
   OR use first name matching:
   ```
   ✅ ALSO GOOD:
   Characters:
   - ALICE SMITH

   ALICE
   Hello!
   ```

---

## Advanced Features

### Multiple Character Names

If a character has a full name, you can use either their full name or first name in the script:

```
Characters:
- DETECTIVE SARAH MILLER
- JOHN ANDERSON

DETECTIVE MILLER
We found evidence at the scene.

JOHN
What kind of evidence?

SARAH
The kind that points to you, John.
```

Both "DETECTIVE MILLER" and "SARAH" will match "DETECTIVE SARAH MILLER".

### Parentheticals and Stage Directions

These are automatically removed from the generated audio:

```
ALICE
(crying)
I can't believe he's gone.

BOB
[Puts hand on her shoulder]
(softly)
Everything will be okay.
```

The audio will only include: "I can't believe he's gone." and "Everything will be okay."

### Stage Directions [Brackets]

For newer models (Turbo v2.5, Multilingual v3), you can use brackets to give performance instructions. These are **preserved** and sent to the AI:

```
JOHN
[whispering] Don't make a sound.
[shouting] Run!
```

**Note:** Older models may read these brackets out loud. Use with caution.

### Scene Headings

Scene headings are recognized but not converted to audio:

```
INT. MANSION - NIGHT
EXT. BEACH - SUNRISE
I/E. CAR - AFTERNOON
```

---

## Troubleshooting

### Error: "No dialogue chunks found in script"

**Cause:** The parser couldn't find any properly formatted dialogue.

**Solutions:**
1. Make sure you have a `Characters:` section at the top
2. Verify character names are in ALL CAPS
3. Check that character definitions start with `-`
4. Ensure character names in dialogue match those in the Characters list
5. Try copying the example above to test

### Error: "No voice configuration found for character: X"

**Cause:** A character in your script doesn't have a voice ID assigned.

**Solutions:**
1. Check the Character Config panel
2. Assign a voice ID to every character detected
3. Make sure character names match exactly (case-sensitive)

### Characters not detected

**Cause:** Character names don't match between the list and dialogue.

**Solutions:**
1. Use consistent capitalization (ALL CAPS)
2. Use full names or ensure first names match
3. Check for typos in character names

---

## Quick Start Template

Copy this template and replace with your content:

```
Characters:
- CHARACTER ONE
- CHARACTER TWO
- CHARACTER THREE

INT. LOCATION - TIME

CHARACTER ONE
First line of dialogue here.

CHARACTER TWO
Response here.

CHARACTER ONE
More dialogue.

CHARACTER THREE: Can also use inline format.
```

---

## Testing Your Format

1. Copy one of the examples above
2. Paste it into the Script Input area
3. Click anywhere outside the text box
4. Check if characters appear in the Character Config panel
5. If characters appear, your format is correct!
6. If not, review the formatting rules above

---

**Need more help?** See the [README.md](README.md) for full documentation.
