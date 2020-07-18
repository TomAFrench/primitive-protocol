import React, { FunctionComponent, useState, useEffect } from "react";
import { ReactComponent as PrimitiveLogo } from "../../icons/primitivelogo.svg";
import ethers from "ethers";
import styled from "styled-components";
import NavRow from "./NavRow";
import Wrapper from "./Wrapper";
import Address from "../Address";
import Button from "../Button";
import { connect, disconnect } from "../../lib/web3";
import AccountCircleIcon from "@material-ui/icons/AccountCircle";
import NotificationsIcon from "@material-ui/icons/Notifications";
const { AddressZero } = ethers.constants;

type NavbarProps = {
    title?: string;
    web3React?: any;
    injected?: any;
};

const Nav = styled.div`
    padding: 16px;
    display: flex;
    flex-direction: row;
    background-color: #040404;
    position: fixed;
    width: 100%;
`;

const Navbar: FunctionComponent<NavbarProps> = ({
    title,
    web3React,
    injected,
}) => {
    const [account, setAccount] = useState<string>(AddressZero);

    useEffect(() => {
        async function address() {
            if (web3React) {
                setAccount(web3React.account || AddressZero);
            }
        }
        address();
    }, [account, web3React]);

    return (
        <Nav>
            <Wrapper
                style={{ margin: "auto auto auto 112px", cursor: "pointer" }}
            >
                <PrimitiveLogo width={50} height={50} href="/" />
            </Wrapper>

            {web3React ? (
                <NavRow>
                    <Wrapper style={{ marginRight: "16px" }}>
                        <NotificationsIcon style={{ color: "white" }} />
                    </Wrapper>
                    <Wrapper style={{ marginRight: "16px" }}>
                        <AccountCircleIcon style={{ color: "white" }} />
                    </Wrapper>
                    <Wrapper>
                        <Button
                            style={{ minHeight: "5vmin" }}
                            disabled={false}
                            onClick={
                                disconnect
                                    ? account != AddressZero
                                        ? async () => disconnect(web3React)
                                        : connect
                                        ? async () =>
                                              connect(web3React, injected)
                                        : () => {
                                              console.log("err no func call");
                                          }
                                    : () => {
                                          console.log("err no func call");
                                      }
                            }
                        >
                            <Address account={account} />
                        </Button>
                    </Wrapper>
                </NavRow>
            ) : (
                <> </>
            )}
        </Nav>
    );
};

export default Navbar;
