import { FlashList } from "@shopify/flash-list";
import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  DEMO_TABLES,
  DemoTable,
  DemoOpenComanda,
  DemoTableStatus,
  TableStatusFilter,
  useDemoTableMapStore,
} from "../src/features/tables/demo-table-map";

const STATUS_PRESENTATION: Record<
  DemoTableStatus,
  { label: string; color: string; background: string; dot: string }
> = {
  free: {
    label: "Livre",
    color: "#176343",
    background: "#E8F4EC",
    dot: "#278455",
  },
  occupied: {
    label: "Ocupada",
    color: "#174B73",
    background: "#E8F1F8",
    dot: "#287BAE",
  },
  reserved: {
    label: "Reservada",
    color: "#754C0B",
    background: "#FFF2D8",
    dot: "#B77A16",
  },
  closing: {
    label: "Em fechamento",
    color: "#75402D",
    background: "#F9ECE7",
    dot: "#B65B3C",
  },
};

const FILTERS: { value: TableStatusFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "free", label: "Livre" },
  { value: "occupied", label: "Ocupada" },
  { value: "reserved", label: "Reservada" },
  { value: "closing", label: "Em fechamento" },
];

function StatusBadge({ status }: { status: DemoTableStatus }) {
  const presentation = STATUS_PRESENTATION[status];

  return (
    <View
      style={[
        styles.statusBadge,
        { backgroundColor: presentation.background },
      ]}
    >
      <Text style={[styles.statusText, { color: presentation.color }]}>
        {presentation.label}
      </Text>
    </View>
  );
}

function TableCard({
  table,
  onPress,
}: {
  table: DemoTable;
  onPress: (table: DemoTable) => void;
}) {
  const status = STATUS_PRESENTATION[table.status];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Mesa ${table.number}. ${status.label}. Estado de demonstração.`}
      accessibilityHint="Abre exemplos demonstrativos de comandas; não executa uma ação real."
      onPress={() => onPress(table)}
      style={({ pressed }) => [
        styles.tableCard,
        pressed && styles.tableCardPressed,
      ]}
    >
      <View style={styles.cardTopRow}>
        <Text style={styles.tableLabel}>MESA</Text>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.statusDot, { backgroundColor: status.dot }]}
        />
      </View>
      <Text style={styles.tableNumber}>{table.number}</Text>
      <StatusBadge status={table.status} />
      {table.openComandas.length > 0 && (
        <Text style={styles.openComandaCount}>
          {table.openComandas.length} comandas · exemplo
        </Text>
      )}
    </Pressable>
  );
}

function TableComandasDemo({
  table,
  onBack,
}: {
  table: DemoTable;
  onBack: () => void;
}) {
  const [selectedComandaId, setSelectedComandaId] = useState<string | null>(
    null,
  );
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const selectedComanda = table.openComandas.find(
    (comanda) => comanda.id === selectedComandaId,
  );

  const selectComanda = (comanda: DemoOpenComanda) => {
    setSelectedComandaId(comanda.id);
    setActionNotice(null);
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <View style={styles.detailScreen}>
        <View style={styles.topBar}>
          <View style={styles.brandLockup}>
            <View style={styles.brandMark}>
              <Text style={styles.brandMarkText}>M</Text>
            </View>
            <Text style={styles.brandName}>13axis</Text>
          </View>
          <View style={styles.demoTopBadge}>
            <View style={styles.demoTopDot} />
            <Text style={styles.demoTopText}>DEMO</Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar ao mapa de mesas"
          onPress={onBack}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.filterChipPressed,
          ]}
        >
          <Text style={styles.backButtonText}>‹</Text>
          <Text style={styles.backButtonLabel}>Mapa de mesas</Text>
        </Pressable>

        <View style={styles.detailHeading}>
          <Text style={styles.eyebrow}>MESA {table.number}</Text>
          <Text accessibilityRole="header" style={styles.title}>
            Comandas
          </Text>
          <Text style={styles.subtitle}>
            Selecione uma existente ou veja a opção de iniciar outra.
          </Text>
          <StatusBadge status={table.status} />
        </View>

        <View accessibilityRole="summary" style={styles.demoNotice}>
          <View style={styles.noticeIcon}>
            <Text style={styles.noticeIconText}>i</Text>
          </View>
          <View style={styles.noticeCopy}>
            <Text style={styles.noticeTitle}>Modo demonstrativo</Text>
            <Text style={styles.noticeBody}>
              Exemplos fictícios. Não há backend, persistência ou sincronização.
            </Text>
          </View>
        </View>

        <View style={styles.comandasHeading}>
          <Text style={styles.sectionTitle}>Comandas abertas</Text>
          <Text style={styles.exampleCount}>
            {table.openComandas.length}{" "}
            {table.openComandas.length === 1 ? "exemplo" : "exemplos"}
          </Text>
        </View>
        <Text style={styles.multipleComandasNote}>
          A amostra permite várias comandas abertas na mesma mesa. Nenhum limite
          de quantidade é aplicado nesta tela.
        </Text>

        {table.openComandas.length > 0 ? (
          <View style={styles.comandaList}>
            {table.openComandas.map((comanda) => {
              const selected = selectedComandaId === comanda.id;
              return (
                <Pressable
                  key={comanda.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Selecionar ${comanda.label} existente, exemplo`}
                  accessibilityState={{ selected }}
                  onPress={() => selectComanda(comanda)}
                  style={({ pressed }) => [
                    styles.comandaOption,
                    selected && styles.comandaOptionSelected,
                    pressed && styles.filterChipPressed,
                  ]}
                >
                  <View style={styles.comandaOptionCopy}>
                    <Text style={styles.comandaOptionTitle}>
                      {comanda.label}
                    </Text>
                    <Text style={styles.comandaOptionDescription}>
                      Selecionar comanda existente
                    </Text>
                  </View>
                  <Text
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                    style={[
                      styles.comandaSelectionMark,
                      selected && styles.comandaSelectionMarkSelected,
                    ]}
                  >
                    {selected ? "✓" : "›"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.noComandas}>
            <Text style={styles.noComandasTitle}>
              Nenhuma comanda aberta neste exemplo
            </Text>
            <Text style={styles.noComandasBody}>
              Os dados são ilustrativos e não representam uma mesa real.
            </Text>
          </View>
        )}

        {selectedComanda && (
          <Text accessibilityLiveRegion="polite" style={styles.inlineNotice}>
            Seleção demonstrativa: {selectedComanda.label}. Nenhuma comanda foi
            carregada ou aberta.
          </Text>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            table.openComandas.length > 0
              ? "Iniciar outra comanda, demonstração"
              : "Iniciar comanda, demonstração"
          }
          onPress={() => {
            setSelectedComandaId(null);
            setActionNotice(
              "Demonstração: nenhuma comanda foi criada ou persistida.",
            );
          }}
          style={({ pressed }) => [
            styles.startComandaButton,
            pressed && styles.startComandaButtonPressed,
          ]}
        >
          <Text style={styles.startComandaTitle}>
            {table.openComandas.length > 0
              ? "Iniciar outra comanda"
              : "Iniciar comanda"}
          </Text>
          <Text style={styles.startComandaSubtitle}>
            Opção demonstrativa · não cria dados
          </Text>
        </Pressable>

        {actionNotice && (
          <Text accessibilityLiveRegion="polite" style={styles.inlineNotice}>
            {actionNotice}
          </Text>
        )}

        <Text style={styles.disclaimer}>
          Interface de demonstração · operações reais não estão conectadas
        </Text>
      </View>
    </SafeAreaView>
  );
}

export default function TablesHomeScreen() {
  const filter = useDemoTableMapStore((state) => state.filter);
  const setFilter = useDemoTableMapStore((state) => state.setFilter);
  const [selectedTable, setSelectedTable] = useState<DemoTable | null>(null);
  const filteredTables = useMemo(
    () =>
      filter === "all"
        ? DEMO_TABLES
        : DEMO_TABLES.filter((table) => table.status === filter),
    [filter],
  );

  const openTableDemo = useCallback((table: DemoTable) => {
    setSelectedTable(table);
  }, []);

  const renderTable = useCallback(
    ({ item }: { item: DemoTable }) => (
      <TableCard table={item} onPress={openTableDemo} />
    ),
    [openTableDemo],
  );

  if (selectedTable) {
    return (
      <TableComandasDemo
        table={selectedTable}
        onBack={() => setSelectedTable(null)}
      />
    );
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <View style={styles.brandLockup}>
            <View style={styles.brandMark}>
              <Text style={styles.brandMarkText}>M</Text>
            </View>
            <Text style={styles.brandName}>13axis</Text>
          </View>
          <View style={styles.demoTopBadge}>
            <View style={styles.demoTopDot} />
            <Text style={styles.demoTopText}>DEMO</Text>
          </View>
        </View>

        <View style={styles.heading}>
          <Text style={styles.eyebrow}>ATENDIMENTO</Text>
          <Text accessibilityRole="header" style={styles.title}>
            Mesas
          </Text>
          <Text style={styles.subtitle}>
            Visualização de exemplo dos estados de mesa.
          </Text>
        </View>

        <View
          accessibilityRole="summary"
          style={styles.demoNotice}
        >
          <View style={styles.noticeIcon}>
            <Text style={styles.noticeIconText}>i</Text>
          </View>
          <View style={styles.noticeCopy}>
            <Text style={styles.noticeTitle}>Modo demonstrativo</Text>
            <Text style={styles.noticeBody}>
              Dados ilustrativos. Sem persistência local ou sincronização.
            </Text>
          </View>
        </View>

        <View style={styles.mapHeading}>
          <Text style={styles.sectionTitle}>Mapa de mesas</Text>
          <Text style={styles.exampleCount}>
            {filteredTables.length} exemplos
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
          accessibilityLabel="Filtrar exemplos pelo estado da mesa"
        >
          {FILTERS.map((item) => {
            const selected = filter === item.value;
            return (
              <Pressable
                key={item.value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setFilter(item.value)}
                style={({ pressed }) => [
                  styles.filterChip,
                  selected && styles.filterChipSelected,
                  pressed && styles.filterChipPressed,
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    selected && styles.filterTextSelected,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <FlashList
          data={filteredTables}
          renderItem={renderTable}
          keyExtractor={(table) => table.id}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.rowSeparator} />}
          showsVerticalScrollIndicator={false}
          accessibilityLabel="Mesas de demonstração"
          ListEmptyComponent={
            <Text style={styles.emptyState}>
              Nenhum exemplo para este filtro.
            </Text>
          }
        />

        <Text style={styles.disclaimer}>
          Apenas interface de demonstração · ações de comanda não conectadas
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F5F6F4",
  },
  screen: {
    flex: 1,
    paddingTop: 8,
  },
  detailScreen: {
    flex: 1,
    paddingTop: 8,
    paddingHorizontal: 20,
  },
  topBar: {
    minHeight: 52,
    marginHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandLockup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  brandMark: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#173B32",
  },
  brandMarkText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  brandName: {
    color: "#173B32",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  demoTopBadge: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: "#E9EFEA",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  demoTopDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#B26A18",
  },
  demoTopText: {
    color: "#5F4826",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  heading: {
    marginTop: 22,
    marginHorizontal: 20,
  },
  eyebrow: {
    color: "#597168",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.25,
  },
  title: {
    marginTop: 4,
    color: "#182A24",
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "800",
    letterSpacing: -0.7,
  },
  subtitle: {
    marginTop: 4,
    color: "#5D6A64",
    fontSize: 14,
    lineHeight: 20,
  },
  demoNotice: {
    minHeight: 72,
    marginTop: 18,
    marginHorizontal: 20,
    padding: 13,
    borderRadius: 16,
    backgroundColor: "#FFF5E5",
    borderWidth: 1,
    borderColor: "#F1D8AC",
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  noticeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4E2C2",
  },
  noticeIconText: {
    color: "#754C0B",
    fontSize: 17,
    fontWeight: "800",
  },
  noticeCopy: {
    flex: 1,
    gap: 2,
  },
  noticeTitle: {
    color: "#513A18",
    fontSize: 13,
    fontWeight: "800",
  },
  noticeBody: {
    color: "#6A573C",
    fontSize: 12,
    lineHeight: 17,
  },
  mapHeading: {
    marginTop: 23,
    marginBottom: 10,
    marginHorizontal: 20,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: "#1E3029",
    fontSize: 18,
    fontWeight: "800",
  },
  exampleCount: {
    color: "#68756E",
    fontSize: 12,
    fontWeight: "600",
  },
  filters: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 8,
  },
  filterChip: {
    minHeight: 44,
    paddingHorizontal: 14,
    justifyContent: "center",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#D8DFDA",
    backgroundColor: "#FFFFFF",
  },
  tableCardPressed: {
    opacity: 0.82,
    borderColor: "#90A59A",
  },
  filterChipSelected: {
    borderColor: "#173B32",
    backgroundColor: "#173B32",
  },
  filterChipPressed: {
    opacity: 0.78,
  },
  filterText: {
    color: "#47564F",
    fontSize: 13,
    fontWeight: "700",
  },
  filterTextSelected: {
    color: "#FFFFFF",
  },
  listContent: {
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  rowSeparator: {
    height: 12,
  },
  openComandaCount: {
    marginTop: 7,
    color: "#56675F",
    fontSize: 11,
    fontWeight: "600",
  },
  backButton: {
    minHeight: 48,
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backButtonText: {
    color: "#173B32",
    fontSize: 28,
    lineHeight: 30,
    fontWeight: "500",
  },
  backButtonLabel: {
    color: "#365348",
    fontSize: 14,
    fontWeight: "700",
  },
  detailHeading: {
    marginTop: 13,
  },
  comandasHeading: {
    marginTop: 23,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  multipleComandasNote: {
    marginTop: 7,
    color: "#66736D",
    fontSize: 12,
    lineHeight: 17,
  },
  comandaList: {
    marginTop: 12,
    gap: 9,
  },
  comandaOption: {
    minHeight: 68,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#E0E6E1",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  comandaOptionSelected: {
    borderColor: "#527D6D",
    backgroundColor: "#F0F6F1",
  },
  comandaOptionCopy: {
    gap: 4,
  },
  comandaOptionTitle: {
    color: "#1E3029",
    fontSize: 15,
    fontWeight: "800",
  },
  comandaOptionDescription: {
    color: "#617068",
    fontSize: 12,
  },
  comandaSelectionMark: {
    color: "#77827C",
    fontSize: 25,
    fontWeight: "500",
  },
  comandaSelectionMarkSelected: {
    color: "#176343",
    fontWeight: "800",
  },
  noComandas: {
    marginTop: 12,
    padding: 16,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#E0E6E1",
    backgroundColor: "#FFFFFF",
    gap: 5,
  },
  noComandasTitle: {
    color: "#2A3B33",
    fontSize: 14,
    fontWeight: "700",
  },
  noComandasBody: {
    color: "#66736D",
    fontSize: 12,
    lineHeight: 17,
  },
  startComandaButton: {
    minHeight: 58,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 16,
    backgroundColor: "#173B32",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  startComandaButtonPressed: {
    backgroundColor: "#285546",
  },
  startComandaTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  startComandaSubtitle: {
    color: "#D8E5DC",
    fontSize: 11,
  },
  inlineNotice: {
    marginTop: 10,
    color: "#40574B",
    fontSize: 12,
    lineHeight: 18,
  },
  tableCard: {
    flex: 1,
    minHeight: 142,
    marginHorizontal: 6,
    padding: 15,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E4E8E4",
    backgroundColor: "#FFFFFF",
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tableLabel: {
    color: "#738078",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tableNumber: {
    marginTop: 5,
    color: "#1B3028",
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  statusBadge: {
    minHeight: 28,
    alignSelf: "flex-start",
    marginTop: 10,
    paddingHorizontal: 10,
    justifyContent: "center",
    borderRadius: 14,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  emptyState: {
    padding: 24,
    color: "#5D6A64",
    textAlign: "center",
    fontSize: 14,
  },
  disclaimer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    color: "#727C76",
    textAlign: "center",
    fontSize: 11,
    lineHeight: 15,
  },
});
