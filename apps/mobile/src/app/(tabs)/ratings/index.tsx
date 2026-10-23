import type { RatedNodeDto } from "@rlo/shared";
import { StyleSheet, View } from "react-native";
import { useRatings } from "@/api/queries";
import { StatBar } from "@/components/ratings";
import { Body, Card, ErrorNote, Label, Loading, Muted, Screen } from "@/components/ui";
import { space } from "@/lib/theme";

/** The rating tree: each category with its attributes (and sub-attributes) below it. */
export default function RatingsScreen() {
  const ratings = useRatings();
  const refresh = () => void ratings.refetch();

  if (ratings.isPending) return <Loading />;
  if (ratings.isError) {
    return (
      <Screen onRefresh={refresh}>
        <ErrorNote error={ratings.error} onRetry={refresh} />
      </Screen>
    );
  }
  if (!ratings.data) {
    return (
      <Screen onRefresh={refresh}>
        <Card>
          <Body>No ratings yet. Finish onboarding on the web to get your OVR.</Body>
        </Card>
      </Screen>
    );
  }

  const { nodes, summary, season } = ratings.data;
  const childrenOf = (id: string) =>
    nodes.filter((n) => n.parentId === id).sort((a, b) => a.sortOrder - b.sortOrder);
  const overall = nodes.find((n) => n.parentId === null);
  const categories = overall ? childrenOf(overall.id) : [];

  return (
    <Screen onRefresh={refresh} refreshing={ratings.isRefetching}>
      <View style={styles.section}>
        <Label>{season.label}</Label>
        {summary && <Muted>{summary}</Muted>}
      </View>
      {categories.map((category) => (
        <Card key={category.id} style={styles.category}>
          <StatBar label={category.name} value={category.value} />
          <Branch nodes={childrenOf(category.id)} childrenOf={childrenOf} />
        </Card>
      ))}
    </Screen>
  );
}

function Branch({
  nodes,
  childrenOf,
}: {
  nodes: RatedNodeDto[];
  childrenOf: (id: string) => RatedNodeDto[];
}) {
  if (nodes.length === 0) return null;
  return (
    <View style={styles.branch}>
      {nodes.map((node) => (
        <View key={node.id} style={styles.node}>
          <StatBar label={node.name} value={node.value} />
          <Branch nodes={childrenOf(node.id)} childrenOf={childrenOf} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.xs },
  category: { gap: space.md },
  branch: { paddingLeft: space.md, gap: space.md },
  node: { gap: space.md },
});
