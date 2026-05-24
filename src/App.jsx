import React, { useCallback, useEffect, useMemo, useState } from "react";

const MOEX_API_BASE = "https://iss.moex.com/iss";

const targetPresets = [
  { label: "Связь", value: 1000 },
  { label: "Еда", value: 30000 },
  { label: "Аренда", value: 50000 },
  { label: "Жизнь", value: 150000 },
];

const investmentScenarios = {
  low: {
    title: "Низкий риск",
    avgYield: 13.3,
    color: "#22c55e",
    description:
      "ОФЗ — самый консервативный вариант. Подходит для спокойного накопления капитала и регулярного купонного дохода.",
    bonds: [
      { name: "ОФЗ 26239", secid: "SU26239RMFS2", term: "на 5 лет", stars: "⭐⭐⭐" },
      { name: "ОФЗ 26240", secid: "SU26240RMFS0", term: "на 10 лет", stars: "⭐⭐⭐" },
      { name: "ОФЗ 26246", secid: "SU26246RMFS7", term: "на 9 лет", stars: "⭐⭐⭐" },
      { name: "ОФЗ 26247", secid: "SU26247RMFS5", term: "на 12 лет", stars: "⭐⭐⭐" },
      { name: "ОФЗ 26248", secid: "SU26248RMFS3", term: "на 13 лет", stars: "⭐⭐⭐" },
      { name: "ОФЗ 26254", secid: "SU26254RMFS1", term: "на 14 лет", stars: "⭐⭐⭐" },
    ],
  },
  medium: {
    title: "Средний риск",
    avgYield: 17.9,
    color: "#3b82f6",
    description:
      "Баланс между доходностью и риском. Доходность выше, но возможны более сильные колебания цены облигаций.",
    bonds: [
      { name: "Селигдар 001Р-10", secid: "RU000A10EC22", term: "на 2 года 9 месяцев", stars: "⭐⭐⭐" },
      { name: "Новые Технологии 001Р-08", query: "Новые Технологии 001Р-08", term: "на 1 год 3 месяца", stars: "⭐⭐⭐" },
      { name: "ВИС ФИНАНС БО-П11", query: "ВИС ФИНАНС БО-П11", term: "на 2 года 9 месяцев", stars: "⭐⭐⭐" },
      { name: "Село Зелёное 001Р-02", query: "Село Зелёное 001Р-02", term: "на 1 год 6 месяцев", stars: "⭐⭐☆" },
      { name: "АФК Система БО 002Р-06", secid: "RU000A10DPW4", term: "на 2 года", stars: "⭐⭐☆" },
    ],
  },
  high: {
    title: "Высокий риск",
    avgYield: 18,
    color: "#f97316",
    description:
      "Более высокая доходность, но и выше риск просадок цены и проблем с выплатами. Подходит только для небольшой части портфеля.",
    bonds: [
      { name: "МГКЛ 001Р-06", secid: "RU000A108ZU2", term: "на 3 года 1 месяц", stars: "⭐☆☆" },
      { name: "Эталон-Финанс 002Р-05", query: "Эталон-Финанс 002Р-05", term: "на 2 года 10 месяцев", stars: "⭐⭐☆" },
      { name: "АйДи Коллект 001Р-08", query: "АйДи Коллект 001Р-08", term: "на 1 год 11 месяцев", stars: "⭐☆☆" },
      { name: "МФК Мани Мен БО-01", query: "МФК Мани Мен БО-01", term: "на 1 год 9 месяцев", stars: "⭐☆☆" },
      { name: "МСБ-Лизинг 003Р-07", query: "МСБ-Лизинг 003Р-07", term: "на 2 года 8 месяцев", stars: "⭐⭐☆" },
    ],
  },
};

function toNumber(value, fallback = 0) {
  const number = Number(String(value).replace(",", "."));
  return Number.isFinite(number) ? number : fallback;
}

function positive(value, fallback = 0) {
  return Math.max(0, toNumber(value, fallback));
}

function formatMoney(value) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatPrice(value) {
  if (!Number.isFinite(value)) return "—";
  return (
    new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value) + " ₽"
  );
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "—";
  return (
    new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2,
    }).format(value) + "%"
  );
}

function formatGoalTime(months) {
  if (!months) return "Позже выбранного срока";
  const years = Math.floor(months / 12);
  const restMonths = months % 12;
  if (years === 0) return `${restMonths} мес.`;
  if (restMonths === 0) return `${years} г.`;
  return `${years} г. ${restMonths} мес.`;
}

function extractTableRows(table) {
  if (!table || !Array.isArray(table.columns) || !Array.isArray(table.data)) return [];
  return table.data.map((row) =>
    table.columns.reduce((acc, column, index) => {
      acc[column] = row[index];
      return acc;
    }, {})
  );
}

function getFirstNumber(...values) {
  for (const value of values) {
    const number = toNumber(value, NaN);
    if (Number.isFinite(number) && number > 0) return number;
  }
  return null;
}

async function findSecidByQuery(query) {
  const url = `${MOEX_API_BASE}/securities.json?q=${encodeURIComponent(query)}&iss.meta=off`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`MOEX search error: ${response.status}`);
  const data = await response.json();
  const rows = extractTableRows(data.securities);
  const bond = rows.find((item) => item.type === "bond" && item.secgroup === "stock_bonds") || rows[0];
  return bond?.secid || bond?.SECID || null;
}

async function fetchBondFromMoex(bond) {
  const secid = bond.secid || (bond.query ? await findSecidByQuery(bond.query) : null);
  if (!secid) return null;

  const url = `${MOEX_API_BASE}/engines/stock/markets/bonds/securities/${encodeURIComponent(
    secid
  )}.json?iss.meta=off&iss.only=securities,marketdata`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`MOEX quote error: ${response.status}`);
  const data = await response.json();

  const security = extractTableRows(data.securities)[0] || {};
  const market = extractTableRows(data.marketdata)[0] || {};

  const rawPrice = getFirstNumber(
    market.LAST,
    market.MARKETPRICE,
    market.LCURRENTPRICE,
    market.WAPRICE,
    security.PREVPRICE,
    security.LPREVPRICE
  );

  const price = rawPrice ? rawPrice * 10 : null;

  const yieldValue = getFirstNumber(
    market.YIELD,
    market.YIELDATWAP,
    market.EFFECTIVEYIELD,
    security.YIELDATPREVWAPRICE,
    security.COUPONPERCENT
  );

  let couponValue = getFirstNumber(security.COUPONVALUE);

  if (bond.name === "МФК Мани Мен БО-01") {
    couponValue = 21.78;
  }

  const couponPeriod = getFirstNumber(security.COUPONPERIOD) || 182;
  const couponYield =
    couponValue && couponPeriod && price
      ? ((couponValue * (365 / couponPeriod)) / price) * 100
      : getFirstNumber(security.COUPONPERCENT);

  return {
    secid,
    price,
    yield: yieldValue,
    shortName: security.SHORTNAME || bond.name,
    couponValue,
    couponPeriod,
    couponYield,
    nextCouponDate: security.NEXTCOUPON || security.COUPONDATE || null,
    maturityDate: security.MATDATE || null,
    fetchedAt: new Date().toISOString(),
  };
}

function flattenBonds() {
  return Object.values(investmentScenarios).flatMap((scenario) => scenario.bonds);
}

function getScenarioLiveYield(scenario, bondPrices) {
  const marketYields = scenario.bonds
    .map((bond) => bondPrices[bond.name]?.yield)
    .filter((value) => Number.isFinite(value) && value > 0);

  if (marketYields.length) {
    return marketYields.reduce((sum, value) => sum + value, 0) / marketYields.length;
  }

  return scenario.avgYield;
}

function getScenarioCouponYield(scenario, bondPrices) {
  const couponYields = scenario.bonds
    .map((bond) => bondPrices[bond.name]?.couponYield)
    .filter((value) => Number.isFinite(value) && value > 0);

  if (couponYields.length) {
    return couponYields.reduce((sum, value) => sum + value, 0) / couponYields.length;
  }

  return getScenarioLiveYield(scenario, bondPrices);
}

function getScenarioAveragePrice(scenario, bondPrices) {
  const prices = scenario.bonds
    .map((bond) => bondPrices[bond.name]?.price)
    .filter((value) => Number.isFinite(value) && value > 0);

  if (prices.length) {
    return prices.reduce((sum, value) => sum + value, 0) / prices.length;
  }

  return 1000;
}

function calculateScenarioTarget({ scenario, bondPrices, targetMonthlyIncome, years, reinvest = true }) {
  const targetMonthly = positive(targetMonthlyIncome);

  const bondRows = scenario.bonds.map((bond) => {
    const market = bondPrices[bond.name] || {};
    const price = Number.isFinite(market.price) && market.price > 0 ? market.price : 1000;
    const couponValue = Number.isFinite(market.couponValue) && market.couponValue > 0 ? market.couponValue : 0;
    const couponPeriod = Number.isFinite(market.couponPeriod) && market.couponPeriod > 0 ? market.couponPeriod : 182;
    const couponPaymentsPerYear = 365 / couponPeriod;
    const annualCouponPerBond = couponValue * couponPaymentsPerYear;
    const monthlyCouponPerBond = annualCouponPerBond / 12;

    return {
      name: bond.name,
      price,
      couponValue,
      couponPeriod,
      couponPaymentsPerYear,
      annualCouponPerBond,
      monthlyCouponPerBond,
    };
  });

  const monthlyCouponPerOneBondSet = bondRows.reduce((sum, item) => sum + item.monthlyCouponPerBond, 0);
  const setsNeeded = monthlyCouponPerOneBondSet > 0 ? Math.ceil(targetMonthly / monthlyCouponPerOneBondSet) : 0;

  const allocation = bondRows.map((item) => ({
    ...item,
    quantity: setsNeeded,
    invested: item.price * setsNeeded,
    monthlyCouponIncome: item.monthlyCouponPerBond * setsNeeded,
    annualCouponIncome: item.annualCouponPerBond * setsNeeded,
  }));

  const targetCapital = allocation.reduce((sum, item) => sum + item.invested, 0);
  const totalBonds = allocation.reduce((sum, item) => sum + item.quantity, 0);
  const monthlyPayment = allocation.reduce((sum, item) => sum + item.monthlyCouponIncome, 0);
  const annualCouponIncome = allocation.reduce((sum, item) => sum + item.annualCouponIncome, 0);
  const averagePrice = totalBonds > 0 ? targetCapital / totalBonds : getScenarioAveragePrice(scenario, bondPrices);
  const couponYield = targetCapital > 0 ? (annualCouponIncome / targetCapital) * 100 : getScenarioCouponYield(scenario, bondPrices);

  const baseMonths = Math.max(1, positive(years, 1) * 12);
  const monthlySavingWithoutReinvest = targetCapital / baseMonths;
  const reinvestDiscount = reinvest ? 1 + couponYield / 100 : 1;
  const monthlySaving = monthlySavingWithoutReinvest / reinvestDiscount;

  return {
    couponYield,
    targetCapital,
    averagePrice,
    totalBonds,
    monthlyPayment,
    annualCouponIncome,
    monthlySaving,
    monthlySavingWithoutReinvest,
    setsNeeded,
    allocation,
  };
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatMonthName(date) {
  return new Intl.DateTimeFormat("ru-RU", { month: "long" }).format(date);
}

function buildCouponCalendar(scenario, bondPrices, allocation = [], monthsAhead = 12) {
  const now = new Date();
  const end = new Date(now);
  end.setMonth(end.getMonth() + monthsAhead);

  const monthMap = {};
  const quantityByBond = allocation.reduce((acc, item) => {
    acc[item.name] = item.quantity;
    return acc;
  }, {});

  scenario.bonds.forEach((bond, index) => {
    const market = bondPrices[bond.name] || {};
    const couponValue = market.couponValue;
    const couponPeriod = market.couponPeriod || 182;
    const quantity = quantityByBond[bond.name] || 0;
    let nextDate = market.nextCouponDate ? new Date(market.nextCouponDate) : addDays(now, 30 + index * 20);

    if (Number.isNaN(nextDate.getTime())) {
      nextDate = addDays(now, 30 + index * 20);
    }

    while (nextDate < now) {
      nextDate = addDays(nextDate, couponPeriod);
    }

    while (nextDate <= end) {
      const key = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`;
      if (!monthMap[key]) {
        monthMap[key] = {
          key,
          month: formatMonthName(nextDate),
          year: nextDate.getFullYear(),
          total: 0,
          payments: [],
        };
      }

      const paymentTotal = Number.isFinite(couponValue) ? couponValue * quantity : null;

      monthMap[key].payments.push({
        name: bond.name,
        date: nextDate.toLocaleDateString("ru-RU"),
        timestamp: nextDate.getTime(),
        coupon: couponValue,
        quantity,
        total: paymentTotal,
      });

      if (Number.isFinite(paymentTotal)) {
        monthMap[key].total += paymentTotal;
      }

      nextDate = addDays(nextDate, couponPeriod);
    }
  });

  return Object.values(monthMap)
    .map((month) => ({
      ...month,
      payments: month.payments.sort((a, b) => a.timestamp - b.timestamp),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

function simulateInvestment({ monthlyContribution, years, annualRate, reinvest, targetCapital = 0 }) {
  const months = Math.max(12, Math.round(positive(years, 1) * 12));
  const monthlyRate = Math.pow(1 + annualRate / 100, 1 / 12) - 1;

  let capital = 0;
  let invested = 0;
  let withdrawnIncome = 0;
  let reachedMonth = null;
  const yearlyData = [];

  for (let month = 1; month <= months; month += 1) {
    capital += positive(monthlyContribution);
    invested += positive(monthlyContribution);

    const income = capital * monthlyRate;

    if (reinvest) {
      capital += income;
    } else {
      withdrawnIncome += income;
    }

    if (!reachedMonth && targetCapital > 0 && capital >= targetCapital) {
      reachedMonth = month;
    }

    if (month % 12 === 0) {
      yearlyData.push({
        year: month / 12,
        capital,
        invested,
        income: Math.max(0, capital - invested),
        passiveIncomeMonth: (capital * annualRate) / 100 / 12,
      });
    }
  }

  return {
    finalCapital: capital,
    invested,
    income: Math.max(0, capital - invested),
    withdrawnIncome,
    reachedMonth,
    yearlyData,
  };
}

function runCalculationTests() {
  const fakeScenario = {
    avgYield: 10,
    bonds: [{ name: "A" }, { name: "B" }],
  };
  const fakePrices = {
    A: { price: 1000, couponValue: 50, couponPeriod: 182, couponYield: 10, yield: 12 },
    B: { price: 1000, couponValue: 50, couponPeriod: 182, couponYield: 10, yield: 12 },
  };

  const target = calculateScenarioTarget({
    scenario: fakeScenario,
    bondPrices: fakePrices,
    targetMonthlyIncome: 10000,
    years: 5,
    reinvest: true,
  });

  const targetNoReinvest = calculateScenarioTarget({
    scenario: fakeScenario,
    bondPrices: fakePrices,
    targetMonthlyIncome: 10000,
    years: 5,
    reinvest: false,
  });

  const simulation = simulateInvestment({ monthlyContribution: 10000, years: 1, annualRate: 0, reinvest: true });

  return [
    {
      name: "Пассивный доход считается как сумма купонов × количество облигаций",
      passed: Math.round(target.monthlyPayment) >= 10000,
    },
    {
      name: "При равном распределении покупается одинаковое количество каждой облигации",
      passed: target.allocation.every((item) => item.quantity === target.setsNeeded),
    },
    {
      name: "Реинвестирование снижает требуемый ежемесячный взнос",
      passed: target.monthlySaving < targetNoReinvest.monthlySaving,
    },
    {
      name: "При 0% доходности и 10 000 ₽/мес за год капитал = 120 000 ₽",
      passed: Math.round(simulation.finalCapital) === 120000,
    },
  ];
}

const calculationTests = runCalculationTests();

function Toggle({ checked, onChange }) {
  return (
    <button type="button" style={styles.toggleRow} onClick={() => onChange(!checked)}>
      <span>
        <span style={styles.toggleTitle}>Реинвестировать доход</span>
        <span style={styles.toggleHint}>Купоны и доход снова вкладываются в портфель</span>
      </span>
      <span style={{ ...styles.toggle, ...(checked ? styles.toggleOn : {}) }}>
        <span style={{ ...styles.toggleKnob, ...(checked ? styles.toggleKnobOn : {}) }} />
      </span>
    </button>
  );
}

function MiniChart({ data }) {
  const max = Math.max(...data.map((item) => item.capital), 1);

  return (
    <div style={styles.chartWrapper}>
      <div style={styles.chartYAxis}>
        <span>{formatMoney(max)}</span>
        <span>{formatMoney(max * 0.5)}</span>
        <span>0 ₽</span>
      </div>

      <div style={styles.chartArea}>
        <div style={styles.chart}>
          {data.map((item) => (
            <div key={item.year} style={styles.barGroup} title={`${item.year} год — ${formatMoney(item.capital)}`}>
              <div style={styles.barTrack}>
                <div style={{ ...styles.bar, height: `${Math.max(5, (item.capital / max) * 100)}%` }} />
              </div>
              <div style={styles.barLabel}>{item.year}г</div>
            </div>
          ))}
        </div>
        <div style={styles.chartXAxis}>Срок инвестирования (годы)</div>
      </div>
    </div>
  );
}

export default function PassiveIncomeCalculator() {
  const [targetMonthlyIncome, setTargetMonthlyIncome] = useState(50000);
  const [selectedScenario, setSelectedScenario] = useState("low");
  const [years, setYears] = useState(10);
  const [reinvest, setReinvest] = useState(true);
  const [bondPrices, setBondPrices] = useState({});
  const [pricesLoading, setPricesLoading] = useState(false);
  const [pricesError, setPricesError] = useState("");
  const [lastPriceUpdate, setLastPriceUpdate] = useState(null);

  const updateBondPrices = useCallback(async () => {
    setPricesLoading(true);
    setPricesError("");

    try {
      const bonds = flattenBonds();
      const results = await Promise.allSettled(bonds.map((bond) => fetchBondFromMoex(bond)));
      const nextPrices = {};

      results.forEach((result, index) => {
        if (result.status === "fulfilled" && result.value) {
          nextPrices[bonds[index].name] = result.value;
        }
      });

      setBondPrices(nextPrices);
      setLastPriceUpdate(new Date());

      const failedCount = results.filter((item) => item.status === "rejected" || !item.value).length;
      if (failedCount > 0) {
        setPricesError(`Не удалось обновить ${failedCount} из ${bonds.length} бумаг. Проверьте SECID/названия или доступ к MOEX.`);
      }
    } catch (error) {
      setPricesError("Не удалось получить цены с Мосбиржи. Попробуйте обновить позже.");
    } finally {
      setPricesLoading(false);
    }
  }, []);

  useEffect(() => {
    updateBondPrices();
  }, [updateBondPrices]);

  const scenario = investmentScenarios[selectedScenario];

  const liveScenarioYields = useMemo(() => {
    return Object.entries(investmentScenarios).reduce((acc, [key, item]) => {
      acc[key] = getScenarioLiveYield(item, bondPrices);
      return acc;
    }, {});
  }, [bondPrices]);

  const liveScenarioYield = liveScenarioYields[selectedScenario] || scenario.avgYield;

  const selectedScenarioResult = useMemo(() => {
    return calculateScenarioTarget({
      scenario,
      bondPrices,
      targetMonthlyIncome,
      years,
      reinvest,
    });
  }, [scenario, bondPrices, targetMonthlyIncome, years, reinvest]);

  const result = useMemo(
    () =>
      simulateInvestment({
        monthlyContribution: selectedScenarioResult.monthlySaving,
        years,
        annualRate: liveScenarioYield,
        reinvest,
        targetCapital: selectedScenarioResult.targetCapital,
      }),
    [selectedScenarioResult.monthlySaving, selectedScenarioResult.targetCapital, years, liveScenarioYield, reinvest]
  );

  const couponCalendar = useMemo(
    () => buildCouponCalendar(scenario, bondPrices, selectedScenarioResult.allocation, 12),
    [scenario, bondPrices, selectedScenarioResult.allocation]
  );

  const testsPassed = calculationTests.every((test) => test.passed);

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div style={styles.logo}>★</div>
        <div>
          <h1 style={styles.title}>Калькулятор пассивного дохода</h1>
          <p style={styles.subtitle}>Выберите цель, срок и сценарий вложений — калькулятор покажет, каким может быть результат.</p>
        </div>
      </section>

      <section style={styles.mainCard}>
        <div style={styles.goalBlock}>
          <div>
            <h2 style={styles.sectionTitle}>Цель по пассивному доходу в месяц</h2>
            <p style={styles.sectionText}>Можно выбрать готовую сумму или ввести свою.</p>
          </div>

          <div style={styles.targetButtons}>
            {targetPresets.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => setTargetMonthlyIncome(item.value)}
                style={{ ...styles.targetButton, ...(targetMonthlyIncome === item.value ? styles.targetButtonActive : {}) }}
              >
                {item.label} — {formatMoney(item.value)}
              </button>
            ))}
          </div>

          <div style={styles.bigInputWrap}>
            <input
              style={styles.bigInput}
              type="number"
              value={targetMonthlyIncome}
              onChange={(event) => setTargetMonthlyIncome(positive(event.target.value))}
            />
            <span style={styles.bigInputSuffix}>₽ / мес.</span>
          </div>
        </div>

        <div style={styles.settingsGrid}>
          <div style={styles.settingCard}>
            <div style={styles.settingHeaderRow}>
              <h3 style={styles.settingTitle}>Вариант инвестирования</h3>
              <button type="button" style={styles.refreshButton} onClick={updateBondPrices} disabled={pricesLoading}>
                {pricesLoading ? "Обновляю..." : "Обновить цены MOEX"}
              </button>
            </div>

            <div style={styles.priceMeta}>
              {lastPriceUpdate ? `Цены обновлены: ${lastPriceUpdate.toLocaleString("ru-RU")}` : "Цены загрузятся автоматически при открытии сайта"}
            </div>

            {pricesError ? <div style={styles.errorBox}>{pricesError}</div> : null}

            <div style={styles.scenarioTabs}>
              {Object.entries(investmentScenarios).map(([key, item]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedScenario(key)}
                  style={{
                    ...styles.scenarioTab,
                    ...(selectedScenario === key ? { ...styles.scenarioTabActive, borderColor: item.color } : {}),
                  }}
                >
                  {item.title}
                  <span>{formatPercent(liveScenarioYields[key] || item.avgYield)} доходность</span>
                </button>
              ))}
            </div>

            <div style={styles.compactPreview}>
              <div style={styles.compactPreviewHeader}>
                <div>
                  <strong style={{ display: "block", marginBottom: 8 }}>{scenario.description.split("—")[0].trim()}</strong>
                  <span>{scenario.description.split("—").slice(1).join("—").trim()}</span>
                </div>
                <span style={{ ...styles.compactPreviewBadge, borderColor: scenario.color, color: scenario.color }}>
                  {scenario.bonds.length} бумаг
                </span>
              </div>

              <div style={styles.compactBondGrid}>
                {scenario.bonds.map((bond) => {
                  const market = bondPrices[bond.name];
                  const allocationItem = selectedScenarioResult.allocation.find((item) => item.name === bond.name);
                  return (
                    <div key={bond.name} style={styles.compactBondCard}>
                      <strong>{bond.name}</strong>
                      <span>{formatPrice(market?.price)} · купить {allocationItem?.quantity?.toLocaleString("ru-RU") || 0} шт.</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={styles.rightInfoColumn}>
            <div style={styles.needInvestBox}>
              <span style={styles.needInvestLabel}>Нужно вложить</span>
              <strong style={styles.needInvestValue}>{formatMoney(selectedScenarioResult.targetCapital)}</strong>
              <small style={styles.needInvestHint}>Чтобы получать около {formatMoney(selectedScenarioResult.monthlyPayment)} в месяц по купонам</small>
            </div>

            <div style={styles.savingGoalBox}>
              <h4 style={styles.savingGoalTitle}>Сколько нужно откладывать в месяц</h4>
              <div style={styles.savingGoalHint}>
                {reinvest
                  ? "С учётом реинвестирования купонов капитал накапливается быстрее."
                  : "Без реинвестирования купоны не докупают облигации, поэтому откладывать нужно больше."}
              </div>

              <div style={styles.savingGoalTop}>
                <div>
                  <div style={styles.savingGoalLabel}>Срок накопления</div>
                  <div style={styles.savingGoalYears}>{years} лет</div>
                </div>

                <div style={styles.savingGoalRight}>
                  <div style={styles.savingGoalLabel}>Нужно откладывать</div>
                  <div style={styles.savingGoalValue}>{formatMoney(selectedScenarioResult.monthlySaving)} / мес.</div>
                </div>
              </div>

              <input
                type="range"
                min="1"
                max="30"
                step="1"
                value={years}
                onChange={(event) => setYears(positive(event.target.value, 1))}
                style={styles.savingGoalSlider}
              />
            </div>

            <Toggle checked={reinvest} onChange={setReinvest} />

            <div style={styles.reinvestInfoBox}>
              <div style={styles.reinvestInfoText}>
                {reinvest
                  ? "Купоны автоматически докупают облигации и ускоряют достижение цели по пассивному доходу."
                  : "Купоны выводятся, а не докупают новые облигации — капитал растёт медленнее."}
              </div>

              <div style={styles.reinvestStats}>
                <div style={styles.reinvestStatCard}>
                  <span>Капитал через {years} лет</span>
                  <strong>{formatMoney(result.finalCapital)}</strong>
                </div>

                <div style={styles.reinvestStatCard}>
                  <span>Цель будет достигнута</span>
                  <strong>{formatGoalTime(result.reachedMonth)}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section style={styles.resultsSection}>
        <div style={styles.topTwoColumns}>
          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>Сколько нужно вложить для вашей цели</h2>
            <p style={styles.sectionText}>Расчёт показывает, какой капитал нужен в выбранной подборке, чтобы получать выбранный пассивный доход.</p>

            <div style={styles.targetScenarioGrid}>
              <div style={{ ...styles.targetScenarioCard, borderColor: scenario.color }}>
                <div style={styles.targetScenarioTop}>
                  <div>
                    <div style={styles.targetScenarioLabel}>Выбранная подборка</div>
                    <h3 style={styles.targetScenarioTitle}>{scenario.title}</h3>
                  </div>
                  <div style={{ ...styles.targetScenarioYield, color: scenario.color }}>{formatPercent(liveScenarioYield)}</div>
                </div>

                <div style={styles.targetScenarioRows}>
                  <div style={styles.targetScenarioRow}>
                    <span>Всего облигаций</span>
                    <strong>{selectedScenarioResult.totalBonds.toLocaleString("ru-RU")} шт.</strong>
                  </div>
                  <div style={styles.targetScenarioRow}>
                    <span>Средняя цена</span>
                    <strong>{formatPrice(selectedScenarioResult.averagePrice)}</strong>
                  </div>
                </div>

                <div style={styles.allocationBlock}>
                  <h4 style={styles.allocationTitle}>Сколько купить каждой облигации</h4>
                  {selectedScenarioResult.allocation.map((item) => (
                    <div key={item.name} style={styles.allocationRow}>
                      <div style={styles.allocationNameCol}>
                        <strong>{item.name}</strong>
                        <span>{formatPrice(item.price)} × {item.quantity.toLocaleString("ru-RU")} шт.</span>
                      </div>
                      <div style={styles.allocationValueCol}>
                        <strong>{formatMoney(item.invested)}</strong>
                        <span>≈ {formatMoney(item.monthlyCouponIncome)} / мес.</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div style={styles.card}>
            <h3 style={styles.settingTitle}>{scenario.title}</h3>
            <p style={styles.sectionText}>{scenario.description}</p>
            <div style={styles.scenarioStatsRow}>
              <span style={styles.scenarioStat}>Средняя доходность: {formatPercent(liveScenarioYield)}</span>
              <span style={styles.scenarioStat}>Бумаг: {scenario.bonds.length}</span>
            </div>
            <div style={styles.bondsGrid}>
              {scenario.bonds.map((bond) => {
                const market = bondPrices[bond.name];
                const allocationItem = selectedScenarioResult.allocation.find((item) => item.name === bond.name);
                return (
                  <div key={bond.name} style={styles.bondCard}>
                    <div style={styles.bondName}>{bond.name}</div>
                    <div style={styles.bondMeta}>{bond.secid || market?.secid || "SECID ищется автоматически"}</div>
                    <div style={styles.bondMeta}>{bond.term}</div>
                    <div style={styles.bondMarketRow}>
                      <span>Цена</span>
                      <strong>{formatPrice(market?.price)}</strong>
                    </div>
                    <div style={styles.bondMarketRow}>
                      <span>Доходность</span>
                      <strong>{formatPercent(market?.yield)}</strong>
                    </div>
                    <div style={styles.bondMarketRow}>
                      <span>Купон</span>
                      <strong>{formatPrice(market?.couponValue)}</strong>
                    </div>
                    <div style={styles.bondMarketRow}>
                      <span>Купить</span>
                      <strong>{allocationItem?.quantity?.toLocaleString("ru-RU") || 0} шт.</strong>
                    </div>
                    <div style={styles.stars}>{bond.stars}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={styles.summaryBox}>
          Чтобы получать <strong>{formatMoney(targetMonthlyIncome)} в месяц</strong>, смотрите блок «Сколько нужно вложить для вашей цели»: там расчёт сделан по купонам выбранной подборки. При сценарии «{scenario.title}» и реинвестировании купонов через {years} лет капитал может составить <strong>{formatMoney(result.finalCapital)}</strong>.
        </div>

        <div style={styles.bottomTwoColumns}>
          <div style={styles.card}>
            <h3 style={styles.settingTitle}>Рост капитала по годам</h3>
            <p style={styles.chartHint}>Слева отображается размер капитала, снизу — срок инвестирования в годах.</p>
            <MiniChart data={result.yearlyData} />
          </div>

          <div style={styles.card}>
            <h3 style={styles.settingTitle}>Календарь выплат купонов</h3>
            <p style={styles.chartHint}>Ближайшие выплаты по облигациям выбранной подборки на 12 месяцев вперёд.</p>
            <div style={styles.couponCalendar}>
              {couponCalendar.length ? (
                couponCalendar.map((month) => (
                  <div key={month.key} style={styles.couponMonth}>
                    <div style={styles.couponMonthHeader}>
                      <strong>
                        {month.month} {month.year}
                      </strong>
                      <span>{formatPrice(month.total)}</span>
                    </div>
                    <div style={styles.couponPayments}>
                      {month.payments.map((payment) => (
                        <div key={`${payment.name}-${payment.date}`} style={styles.couponPaymentRow}>
                          <span>{payment.date}</span>
                          <strong>{payment.name}</strong>
                          <em>
                            {formatPrice(payment.total)} <small>({payment.quantity} шт.)</small>
                          </em>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div style={styles.emptyCalendar}>Календарь появится после загрузки данных MOEX.</div>
              )}
            </div>
          </div>
        </div>

        <div style={styles.testsCard}>
          <span style={{ ...styles.testBadge, ...(testsPassed ? styles.testBadgeOk : styles.testBadgeFail) }}>
            {testsPassed ? "Проверка расчётов пройдена" : "Есть ошибка в проверке расчётов"}
          </span>
        </div>
      </section>

      <footer style={styles.footer}>
        Здесь канал для тех, кто стремится получать и увеличивать свой пассивный доход.<br />👉{" "}
        <a href="https://t.me/passive_dohod_bot" target="_blank" rel="noreferrer" style={styles.footerLink}>
          Система пассивного дохода
        </a>
      </footer>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "radial-gradient(circle at top left, rgba(59,130,246,.18), transparent 36%), #070b18",
    color: "#ffffff",
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    padding: "28px 18px 40px",
  },
  hero: {
    maxWidth: 1180,
    margin: "0 auto 22px",
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "0 4px",
  },
  logo: {
    width: 46,
    height: 46,
    borderRadius: 14,
    background: "linear-gradient(135deg, #2563eb, #7c3aed)",
    display: "grid",
    placeItems: "center",
    fontSize: 22,
    fontWeight: 900,
  },
  title: {
    margin: 0,
    fontSize: "clamp(26px, 5vw, 42px)",
    letterSpacing: "-0.04em",
  },
  subtitle: {
    margin: "6px 0 0",
    color: "#9ca3af",
    fontSize: 15,
    lineHeight: 1.5,
  },
  mainCard: {
    maxWidth: 1180,
    margin: "0 auto 22px",
    background: "linear-gradient(180deg, #101729, #0d1426)",
    border: "1px solid #23304d",
    borderRadius: 28,
    padding: 24,
    boxShadow: "0 24px 80px rgba(0,0,0,.28)",
  },
  goalBlock: {
    display: "grid",
    gap: 16,
    marginBottom: 24,
    paddingBottom: 24,
    borderBottom: "1px solid #23304d",
  },
  sectionTitle: {
    margin: 0,
    fontSize: 22,
    letterSpacing: "-0.03em",
  },
  sectionText: {
    margin: "6px 0 0",
    color: "#9ca3af",
    lineHeight: 1.55,
  },
  targetButtons: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  },
  targetButton: {
    border: "1px solid #334155",
    background: "#070b18",
    color: "#ffffff",
    borderRadius: 999,
    padding: "11px 16px",
    fontSize: 14,
    cursor: "pointer",
    transition: "border-color .2s ease, transform .2s ease, background .2s ease",
  },
  targetButtonActive: {
    borderColor: "#38bdf8",
    boxShadow: "0 0 0 3px rgba(56,189,248,.12)",
  },
  bigInputWrap: {
    display: "flex",
    alignItems: "center",
    border: "1px solid #334155",
    background: "#070b18",
    borderRadius: 18,
    padding: "0 16px",
  },
  bigInput: {
    width: "100%",
    background: "transparent",
    color: "#ffffff",
    border: 0,
    outline: 0,
    fontSize: 24,
    padding: "16px 0",
  },
  bigInputSuffix: {
    color: "#9ca3af",
    whiteSpace: "nowrap",
  },
  settingsGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.15fr) minmax(340px, .85fr)",
    gap: 20,
    alignItems: "stretch",
  },
  settingCard: {
    border: "1px solid #23304d",
    background: "#0b1120",
    borderRadius: 24,
    padding: 20,
    minHeight: 0,
  },
  settingHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    marginBottom: 12,
  },
  settingTitle: {
    margin: "0 0 14px",
    fontSize: 18,
  },
  refreshButton: {
    border: "1px solid #38bdf8",
    background: "rgba(56,189,248,.12)",
    color: "#dbeafe",
    borderRadius: 999,
    padding: "9px 13px",
    cursor: "pointer",
    fontWeight: 800,
  },
  priceMeta: {
    color: "#9ca3af",
    fontSize: 12,
    marginBottom: 12,
  },
  errorBox: {
    background: "rgba(249,115,22,.12)",
    border: "1px solid rgba(249,115,22,.35)",
    color: "#fed7aa",
    borderRadius: 14,
    padding: 10,
    marginBottom: 12,
    fontSize: 13,
  },
  scenarioTabs: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
  },
  scenarioTab: {
    border: "1px solid #23304d",
    background: "#111827",
    color: "#ffffff",
    borderRadius: 18,
    padding: 14,
    cursor: "pointer",
    textAlign: "left",
    fontWeight: 800,
    display: "grid",
    gap: 7,
    minHeight: 78,
    alignContent: "center",
    transition: "border-color .2s ease, box-shadow .2s ease, transform .2s ease",
  },
  scenarioTabActive: {
    background: "#07111f",
    boxShadow: "0 0 0 3px rgba(56,189,248,.12)",
  },
  toggleRow: {
    width: "100%",
    border: "1px solid #334155",
    background: "#070b18",
    color: "#ffffff",
    borderRadius: 18,
    padding: 14,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    textAlign: "left",
    cursor: "pointer",
  },
  toggleTitle: {
    display: "block",
    fontWeight: 800,
  },
  toggleHint: {
    display: "block",
    color: "#9ca3af",
    fontSize: 12,
    marginTop: 4,
  },
  toggle: {
    width: 52,
    height: 30,
    background: "#334155",
    borderRadius: 999,
    position: "relative",
    flex: "0 0 auto",
  },
  toggleOn: {
    background: "#22c55e",
  },
  toggleKnob: {
    width: 24,
    height: 24,
    background: "#ffffff",
    borderRadius: "50%",
    position: "absolute",
    top: 3,
    left: 3,
  },
  toggleKnobOn: {
    left: 25,
  },
  reinvestInfoBox: {
    border: "1px solid rgba(34,197,94,.25)",
    background: "rgba(34,197,94,.08)",
    borderRadius: 18,
    padding: 14,
    display: "grid",
    gap: 12,
  },
  reinvestInfoText: {
    color: "#bbf7d0",
    fontSize: 13,
    lineHeight: 1.5,
  },
  reinvestStats: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  reinvestStatCard: {
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: 14,
    padding: 12,
    background: "rgba(0,0,0,.18)",
    display: "grid",
    gap: 6,
    color: "#ffffff",
  },
  topTwoColumns: {
    display: "grid",
    gridTemplateColumns: "minmax(0, .95fr) minmax(0, 1.05fr)",
    gap: 20,
    alignItems: "start",
  },
  bottomTwoColumns: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
    gap: 20,
    alignItems: "start",
  },
  resultsSection: {
    maxWidth: 1180,
    margin: "0 auto",
    display: "grid",
    gap: 20,
  },
  rightInfoColumn: {
    display: "grid",
    gap: 14,
    alignContent: "start",
  },
  compactPreview: {
    marginTop: 18,
    border: "1px solid #23304d",
    background: "#070b18",
    borderRadius: 22,
    padding: 18,
  },
  compactPreviewHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 22,
    lineHeight: 1.55,
    alignItems: "flex-start",
  },
  compactPreviewBadge: {
    border: "1px solid",
    borderRadius: 999,
    padding: "7px 12px",
    height: "fit-content",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
    marginTop: 2,
  },
  compactBondGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },
  compactBondCard: {
    border: "1px solid #17243c",
    background: "#0b1120",
    borderRadius: 16,
    padding: 12,
    display: "grid",
    gap: 6,
    color: "#dbeafe",
    fontSize: 13,
    minHeight: 66,
  },
  targetScenarioGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(280px, 1fr)",
    gap: 14,
    marginTop: 16,
  },
  targetScenarioCard: {
    background: "#070b18",
    border: "1px solid #23304d",
    borderRadius: 22,
    padding: 20,
  },
  targetScenarioTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 14,
  },
  targetScenarioLabel: {
    color: "#9ca3af",
    fontSize: 13,
  },
  targetScenarioTitle: {
    margin: "4px 0 0",
    fontSize: 21,
    letterSpacing: "-0.03em",
  },
  targetScenarioYield: {
    fontSize: 20,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  needInvestBox: {
    background: "linear-gradient(135deg, #000000, #050816)",
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: 22,
    padding: 20,
  },
  needInvestLabel: {
    display: "block",
    color: "#9ca3af",
    fontSize: 13,
    marginBottom: 8,
  },
  needInvestValue: {
    display: "block",
    fontSize: "clamp(28px, 4vw, 38px)",
    lineHeight: 1.05,
    letterSpacing: "-0.04em",
    wordBreak: "break-word",
  },
  needInvestHint: {
    display: "block",
    color: "#9ca3af",
    marginTop: 8,
  },
  savingGoalBox: {
    border: "1px solid #23304d",
    background: "#0b1120",
    borderRadius: 20,
    padding: 18,
  },
  savingGoalTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 800,
    color: "#ffffff",
  },
  savingGoalHint: {
    marginTop: 6,
    color: "#9ca3af",
    fontSize: 13,
    lineHeight: 1.5,
  },
  savingGoalTop: {
    marginTop: 18,
    display: "grid",
    gridTemplateColumns: "1fr 1.2fr",
    gap: 16,
    alignItems: "end",
  },
  savingGoalLabel: {
    color: "#9ca3af",
    fontSize: 13,
    marginBottom: 4,
  },
  savingGoalYears: {
    fontSize: 34,
    fontWeight: 900,
    lineHeight: 1,
  },
  savingGoalRight: {
    textAlign: "right",
  },
  savingGoalValue: {
    fontSize: "clamp(24px, 3vw, 32px)",
    fontWeight: 900,
    lineHeight: 1.1,
    wordBreak: "break-word",
  },
  savingGoalSlider: {
    width: "100%",
    marginTop: 18,
    accentColor: "#22d3ee",
    cursor: "pointer",
  },
  targetScenarioRows: {
    display: "grid",
    gap: 10,
  },
  allocationBlock: {
    marginTop: 16,
    borderTop: "1px solid #23304d",
    paddingTop: 14,
    display: "grid",
    gap: 10,
  },
  allocationTitle: {
    margin: "0 0 4px",
    fontSize: 15,
    color: "#dbeafe",
  },
  allocationRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 14,
    alignItems: "center",
    border: "1px solid #17243c",
    borderRadius: 16,
    padding: 12,
    color: "#cbd5e1",
  },
  allocationNameCol: {
    display: "grid",
    gap: 4,
  },
  allocationValueCol: {
    display: "grid",
    gap: 4,
    textAlign: "right",
  },
  targetScenarioRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    color: "#cbd5e1",
    borderBottom: "1px solid #23304d",
    paddingBottom: 8,
  },
  card: {
    background: "#101729",
    border: "1px solid #23304d",
    borderRadius: 24,
    padding: 20,
  },
  chartWrapper: {
    display: "flex",
    gap: 12,
    alignItems: "stretch",
  },
  chartYAxis: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    color: "#94a3b8",
    fontSize: 12,
    padding: "8px 0",
    minWidth: 90,
  },
  chartArea: {
    flex: 1,
  },
  chartHint: {
    color: "#94a3b8",
    fontSize: 13,
    marginTop: "-6px",
    marginBottom: 14,
  },
  chart: {
    height: 280,
    display: "flex",
    gap: 8,
    alignItems: "end",
    padding: "18px 10px 10px",
    borderRadius: 18,
    background: "#0b1120",
    overflowX: "auto",
  },
  barGroup: {
    minWidth: 34,
    height: "100%",
    display: "grid",
    gridTemplateRows: "1fr auto",
    gap: 8,
  },
  barTrack: {
    height: "100%",
    display: "flex",
    alignItems: "end",
  },
  bar: {
    width: "100%",
    borderRadius: "10px 10px 4px 4px",
    background: "linear-gradient(180deg, #38bdf8, #2563eb)",
  },
  chartXAxis: {
    textAlign: "center",
    color: "#94a3b8",
    fontSize: 13,
    marginTop: 10,
  },
  barLabel: {
    textAlign: "center",
    color: "#9ca3af",
    fontSize: 12,
  },
  scenarioStatsRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    margin: "14px 0",
  },
  scenarioStat: {
    background: "#0b1120",
    border: "1px solid #23304d",
    borderRadius: 999,
    padding: "8px 11px",
    color: "#dbeafe",
    fontSize: 13,
    fontWeight: 800,
  },
  bondsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: 14,
  },
  bondCard: {
    border: "1px solid #23304d",
    borderRadius: 18,
    padding: 15,
    background: "#070b18",
    minHeight: 176,
  },
  bondName: {
    fontWeight: 900,
    marginBottom: 6,
  },
  bondMeta: {
    color: "#9ca3af",
    fontSize: 13,
    marginBottom: 5,
  },
  bondMarketRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    color: "#cbd5e1",
    fontSize: 13,
    marginTop: 8,
    alignItems: "baseline",
  },
  stars: {
    marginTop: 6,
    color: "#facc15",
  },
  couponCalendar: {
    display: "grid",
    gap: 12,
    maxHeight: 350,
    overflowY: "auto",
    paddingRight: 4,
  },
  couponMonth: {
    border: "1px solid #23304d",
    background: "#070b18",
    borderRadius: 16,
    padding: 14,
  },
  couponMonthHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    color: "#dbeafe",
    marginBottom: 10,
    textTransform: "capitalize",
  },
  couponPayments: {
    display: "grid",
    gap: 8,
  },
  couponPaymentRow: {
    display: "grid",
    gridTemplateColumns: "82px minmax(0, 1fr) auto",
    gap: 12,
    color: "#cbd5e1",
    fontSize: 13,
    alignItems: "center",
    borderTop: "1px solid #17243c",
    paddingTop: 9,
  },
  emptyCalendar: {
    border: "1px dashed #334155",
    borderRadius: 16,
    padding: 18,
    color: "#94a3b8",
    textAlign: "center",
  },
  summaryBox: {
    background: "linear-gradient(135deg, rgba(34,197,94,.12), rgba(56,189,248,.12))",
    border: "1px solid rgba(56,189,248,.35)",
    borderRadius: 22,
    padding: 20,
    lineHeight: 1.7,
    color: "#dbeafe",
  },
  testsCard: {
    display: "flex",
    justifyContent: "center",
  },
  testBadge: {
    borderRadius: 999,
    padding: "8px 12px",
    fontSize: 12,
    fontWeight: 800,
  },
  testBadgeOk: {
    background: "rgba(34,197,94,.14)",
    color: "#bbf7d0",
    border: "1px solid rgba(34,197,94,.3)",
  },
  testBadgeFail: {
    background: "rgba(239,68,68,.14)",
    color: "#fecaca",
    border: "1px solid rgba(239,68,68,.3)",
  },
  footer: {
    maxWidth: 1180,
    margin: "22px auto 0",
    padding: 20,
    textAlign: "center",
    color: "#9ca3af",
    lineHeight: 1.7,
  },
  footerLink: {
    color: "#38bdf8",
    fontWeight: 900,
    textDecoration: "none",
  },
  "@media": {},
};
