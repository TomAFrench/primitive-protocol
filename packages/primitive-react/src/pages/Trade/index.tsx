import React, {
    FunctionComponent,
    useEffect,
    useState,
    useContext,
} from "react";
import Page from "../../components/Page";
import H3 from "../../components/H3";
import TableRow from "./TableRow";
import styled from "styled-components";
import { useWeb3React } from "@web3-react/core";
import { InjectedConnector } from "@web3-react/injected-connector";
import Section from "../../components/Section";
import Cart from "./Cart";
import Loading from "../../components/Loading";
import {
    safeMint,
    estimateGas,
    estimateMintGas,
    getOptionParameters,
} from "../../lib/option";
import ethers from "ethers";
import Header from "./Header";
import Row from "../../components/Row";
import Column from "../../components/Column";
import TableButtons from "./TableButtons";
import {
    Trader,
    Option,
    UniswapFactory,
    UniswapRouter,
    UniswapPair,
    Token,
} from "@primitivefi/sdk";
import TraderDeployed from "@primitivefi/contracts/deployments/rinkeby/Trader.json";
import Stablecoin from "@primitivefi/contracts/deployments/rinkeby/USDC.json";
import Ether from "@primitivefi/contracts/deployments/rinkeby/ETH.json";
import { parseEther } from "ethers/utils";
import { getPair } from "../../lib/pool";
import Positions from "./Positions";
import { OrderContext } from "../../contexts/OrderContext";
import { PrimitiveContext } from "../../contexts/PrimitiveContext";

const TABLE_HEADERS = [
    "Strike",
    "Breakeven",
    "Open Interest",
    "Volume 24hr",
    "% Change 24hr",
    "Price",
];

const OPTIONS_ARRAY = ["0x6AFAC69a1402b810bDB5733430122264b7980b6b"];

type TradeProps = {
    web3?: any;
};

export type OrderDetails = {
    tokenId: number;
    orderAmount: number;
    isBuyOrder: boolean;
};

export const View = styled.div`
    display: flex;
    flex-direction: column;
    max-width: 100%;
    padding: 100px 16px 0 16px;
    margin: 0 auto;
    margin-right: 0;
`;

const Table = styled.div`
    display: flex;
    flex-direction: column;
    width: 100%;
    margin: 1em auto;
`;

const TableHeader = styled.div`
    display: flex;
    flex-direction: row;
    width: 100%;
    margin: 1em auto;
`;

const TableHeaderText = styled(H3)`
    text-transform: uppercase;
    color: "#212121";
    letter-spacing: 0.025em;
`;

const TradeView = styled(Row)`
    margin: 128px;
    @media (max-width: 375px) {
        margin: 48px auto;
    }
`;

const TableView = styled(Column)`
    width: 65%;
`;

const CartView = styled(Column)`
    width: 35%;
    display: flex;
    flex-direction: column;
`;

const Trade: FunctionComponent<TradeProps> = () => {
    const [isBuy, setIsBuy] = useState<boolean>(true);
    const [isCall, setIsCall] = useState<boolean>(true);
    const [expiry, setExpiry] = useState<any>();
    const [gasSpend, setGasSpend] = useState<any>();
    const [parameters, setParameters] = useState<any>();
    const [tableData, setTableData] = useState<any>();
    const [totalDebit, setTotalDebit] = useState<any>();
    const [orderData, setOrderData] = useContext(OrderContext);
    const [primitiveData, setPrimitiveData] = useContext(PrimitiveContext);

    const injected = new InjectedConnector({
        supportedChainIds: [1, 3, 4, 5, 42],
    });
    const web3React = useWeb3React();
    const provider = web3React.library || ethers.getDefaultProvider("rinkeby");

    const updateTable = (isBuy, isCall) => {
        setIsCall(isCall);
        setIsBuy(isBuy);
    };

    const submitOrder = async () => {
        try {
            let gas = await estimateMintGas(
                provider,
                "0x6AFAC69a1402b810bDB5733430122264b7980b6b",
                1
            );
            setGasSpend(gas.toString());
        } catch (err) {
            console.log(err);
        }
        try {
            await safeMint(
                provider,
                "0x6AFAC69a1402b810bDB5733430122264b7980b6b",
                1
            );
        } catch (err) {
            console.log(err);
        }
    };

    const getTable = async () => {
        let data = {};
        for (let i = 0; i < OPTIONS_ARRAY.length; i++) {
            let table = await getTableData(OPTIONS_ARRAY[i]);
            data[i] = table;
        }
        return data;
    };

    useEffect(() => {
        async function updateParams() {
            let params = await getOptionParameters(
                provider,
                "0x6AFAC69a1402b810bDB5733430122264b7980b6b"
            );
            setParameters(params);
            let data = await getTable();
            setTableData(data);
            await updateOptionDetails();
        }
        updateParams();
    }, [web3React.library]);

    const getPremium = async (optionAddress) => {
        const pairAddress = await getPair(provider, optionAddress);
        // need price to calc premium + breakeven, total liquidity for option, volume
        const pair = new UniswapPair(pairAddress, provider);
        const token0 = await pair.token0();
        const reserves = await pair.getReserves();
        let premium = 0;

        if (token0 == optionAddress) {
            premium = await pair.price0CumulativeLast();
        } else {
            premium = await pair.price1CumulativeLast();
        }

        if (premium == 0) {
            premium = reserves._reserve0 / reserves._reserve1;
        }
        return premium;
    };

    const getPairData = async () => {
        const optionAddress = "0x6AFAC69a1402b810bDB5733430122264b7980b6b";
        const pairAddress = await getPair(provider, optionAddress);
        // need price to calc premium + breakeven, total liquidity for option, volume
        const pair = new UniswapPair(pairAddress, provider);
        const token0 = await pair.token0();
        const reserves = await pair.getReserves();
        let premium = 0;
        let openInterest = 0;
        if (token0 == optionAddress) {
            premium = await pair.price0CumulativeLast();
            openInterest = reserves._reserve0;
        } else {
            premium = await pair.price1CumulativeLast();
            openInterest = reserves._reserve1;
        }

        if (premium == 0) {
            premium = reserves._reserve0 / reserves._reserve1;
        }
        return { premium, openInterest };
    };

    const getOpenInterest = async (optionAddress) => {
        const pairAddress = await getPair(provider, optionAddress);
        const pair = new UniswapPair(pairAddress, provider);
        const token0 = await pair.token0();
        const reserves = await pair.getReserves();
        let openInterest = 0;
        if (token0 == optionAddress) {
            openInterest = reserves._reserve0;
        } else {
            openInterest = reserves._reserve1;
        }

        return openInterest;
    };

    const getOptionParams = async (optionAddress) => {
        const params = await getOptionParameters(provider, optionAddress);
        return params;
    };

    const getTableData = async (optionAddress) => {
        let params = await getOptionParams(optionAddress);
        let price = "100";
        let pair = await getPairData();
        return { params, price, pair };
    };

    const testFunc = async () => {
        if (web3React.library) {
            const signer = await web3React.library.getSigner();
            const trader = new Trader(TraderDeployed.address, signer);

            const optionAddr = "0x6AFAC69a1402b810bDB5733430122264b7980b6b";
            const option = new Option(optionAddr, signer);

            const uniFac = new UniswapFactory(
                "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
                signer
            );

            const uniRoutAddr = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
            const uniRout = new UniswapRouter(uniRoutAddr, signer);
            const stablecoin = new Token(Stablecoin.address, signer);
            const optionToken = new Token(optionAddr, signer);
            const underlyingToken = new Token(Ether.address, signer);
            const poolAddr = await uniFac.getPair(
                optionAddr,
                Stablecoin.address
            );

            /* try {
                await stablecoin.approve(uniRoutAddr, parseEther("10000000"));
                await optionToken.approve(uniRoutAddr, parseEther("10000000"));
                console.log(
                    await signer.getAddress(),
                    (
                        await underlyingToken.balanceOf(
                            await signer.getAddress()
                        )
                    ).toString()
                );
                await underlyingToken.approve(
                    uniRoutAddr,
                    parseEther("10000000")
                );
                await trader.safeMint(
                    optionAddr,
                    parseEther("5000"),
                    await signer.getAddress()
                );
                console.log(
                    (
                        await option.balanceOf(await signer.getAddress())
                    ).toString()
                );
                await uniRout.addLiquidity(
                    optionAddr,
                    Stablecoin.address,
                    parseEther("5000"),
                    parseEther("5000"),
                    1,
                    1,
                    await signer.getAddress(),
                    +new Date() + 1000000
                );
            } catch (err) {
                console.log(err);
            } */
        }
    };

    const updateOptionDetails = async () => {
        let newOptions = {};
        for (let i = 0; i < OPTIONS_ARRAY.length; i++) {
            let option = OPTIONS_ARRAY[i];
            let premium = await getPremium(option);
            let openInterest = await getOpenInterest(option);
            let params = await getOptionParams(option);
            Object.assign(newOptions, {
                [option]: {
                    premium: premium,
                    openInterest: openInterest,
                    params: params,
                },
            });
        }

        setPrimitiveData((prevState) => {
            return { ...prevState, options: newOptions };
        });
    };

    const updateOrderContext = async () => {
        let cart = orderData?.cart;
        let prices = {};
        let premiums = {};
        let debit;
        for (let i = 0; i < cart.length; i++) {
            let premium;
            try {
                premium = await getPremium(cart[i]);
            } catch (err) {
                if (cart[i] != ethers.constants.AddressZero) {
                    console.log(err);
                }
                premium = 0;
            }
            premiums[cart[i]] = premium;
            debit = debit + premium;
        }
        Object.assign(prices, {
            premiums: premiums,
            total: debit,
        });
        setOrderData((prevState) => {
            return { ...prevState, prices: prices };
        });
    };

    useEffect(() => {
        const run = async () => {
            await updateOrderContext();
            await updateOptionDetails();
        };
        run();
        console.log(orderData, primitiveData);
    }, [orderData?.cart]);

    return (
        <Page web3React={web3React} injected={injected}>
            <TradeView id="trade-view">
                <TableView id="table-view">
                    <Header />

                    <Row
                        id="table-view-select-container"
                        style={{ width: "100%" }}
                    >
                        <Section
                            style={{
                                margin: "2em auto 2em 0",
                            }}
                        >
                            <TableButtons update={updateTable} />
                        </Section>
                    </Row>

                    <TableHeader id="table-header">
                        {TABLE_HEADERS.map((v) => (
                            <TableHeaderText style={{ width: "20%" }}>
                                {v}
                            </TableHeaderText>
                        ))}
                    </TableHeader>

                    <Table id="table">
                        {tableData ? (
                            OPTIONS_ARRAY.map((v, i) => (
                                <TableRow option={v} data={tableData[i]} />
                            ))
                        ) : (
                            <Loading />
                        )}
                    </Table>
                </TableView>

                <CartView id="cart-position-view">
                    <Cart submitOrder={submitOrder} />

                    {/* <Positions
                                        cart={cart}
                                        submitOrder={submitOrder}
                                        gasSpend={gasSpend}
                                        ethPrice={"100"}
                                        total={totalDebit}
                                    /> */}
                </CartView>
            </TradeView>
        </Page>
    );
};

export default Trade;
