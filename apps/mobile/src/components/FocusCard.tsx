import { Text, View } from "react-native";
import { useFocus } from "@/api/weekly";
import { colors, space } from "@/lib/theme";
import { Muted, Section } from "./ui";

/** This week's focus goals from the latest weekly review. */
export function FocusCard() {
  const focus = useFocus();
  if (!focus.data?.length) return null;
  return (
    <Section
      title="This week's focus"
      action={{ label: "Weekly review →", href: "/week" }}
      style={{ borderColor: "rgba(60,242,200,0.3)" }}
    >
      <View style={{ gap: space.xs }}>
        {focus.data.map((g) => (
          <Text key={g.title} style={{ color: colors.court100, fontSize: 15, lineHeight: 21 }}>
            <Text style={{ fontWeight: "600" }}>{g.title}</Text> <Muted>{g.detail}</Muted>
          </Text>
        ))}
      </View>
    </Section>
  );
}
